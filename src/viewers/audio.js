/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gly from 'gi://Gly';
import GlyGtk4 from 'gi://GlyGtk4';
import GObject from 'gi://GObject';
import Gst from 'gi://Gst';
import GstTag from 'gi://GstTag';
import Gtk from 'gi://Gtk';
import Soup from 'gi://Soup';
import Sushi from 'gi://Sushi';
// eslint-disable-next-line no-restricted-properties
const Format = imports.format;

import {Renderer, ResizePolicy} from '../core/renderer.js';
const TotemMimeTypes = imports.util.totemMimeTypes;
import {CoverPaintable} from '../widgets/coverPaintable.js';

Gio._promisify(Gly.Loader.prototype, 'load_async', 'load_finish');
Gio._promisify(Gly.Image.prototype, 'next_frame_async', 'next_frame_finish');

const COVER_ART_ARCHIVE_URL = "https://coverartarchive.org/release/%s";
const MUSIC_BRAINZ_ASIN_FORMAT = "https://musicbrainz.org/ws/2/release/?query=release:\"%s\"AND artist:\"%s\"&limit=1&fmt=json";
const fetchCoverArt = function(_tagList, _cancellable, _callback) {
    async function _fetchFromTags(cancellable) {
        let coverSample = null;
        let idx = 0;

        while (true) {
            let [res, sample] = _tagList.get_sample_index(Gst.TAG_IMAGE, idx);
            if (!res)
                break;

            idx++;

            let caps = sample.get_caps();
            let capsStruct = caps.get_structure(0);
            let [r, type] = capsStruct.get_enum('image-type', GstTag.TagImageType.$gtype);
            if (type === GstTag.TagImageType.UNDEFINED) {
                coverSample = sample;
            } else if (type === GstTag.TagImageType.FRONT_COVER) {
                coverSample = sample;
                break;
            }
        }

        // Fallback to preview
        if (!coverSample)
            coverSample = _tagList.get_sample_index(Gst.TAG_PREVIEW_IMAGE, 0)[1];

        if (coverSample) {
            try {
                return await _fetchFromGstSample(coverSample, cancellable)
            } catch (e) {
                console.warn(e, 'Unable to fetch cover art from GstSample');
            }
        }
        return null;
    }

    function _getCacheFile(mbid) {
        let cachePath = GLib.build_filenamev([GLib.get_user_cache_dir(), 'sushi']);
        return Gio.File.new_for_path(GLib.build_filenamev([cachePath, `${mbid}.jpg`]));
    }

    async function _fetchFromFile(file, cancellable) {
        const loader = Gly.Loader.new(file);
        const image = await loader.load_async(cancellable);
        const frame = await image.next_frame_async(cancellable);
        return GlyGtk4.frame_get_texture(frame);
    }

    async function _fetchFromGstSample(sample, cancellable) {
        const buffer = sample.get_buffer();
        const [ok, info] = buffer.map(Gst.MapFlags.READ);
        if (!ok)
          throw new Error('Failed to map GstBuffer');
        const bytes = GLib.Bytes.new(info.data);
        const loader = Gly.Loader.new_for_bytes(bytes);
        const image = await loader.load_async(cancellable);
        const frame = await image.next_frame_async(cancellable);
        return GlyGtk4.frame_get_texture(frame);
    }

    function _fetchFromCache(mbid, cancellable, done) {
        let file = _getCacheFile(mbid);
        _fetchFromFile(file, cancellable)
          .then(texture => done(null, texture))
          .catch(error => done(error, null));
    }

    function _saveToCache(mbid, stream, done) {
        let cacheFile = _getCacheFile(mbid);
        let cachePath = cacheFile.get_parent().get_path();
        GLib.mkdir_with_parents(cachePath, 448);

        cacheFile.replace_async(null, false, Gio.FileCreateFlags.PRIVATE, 0, _cancellable, (f, res) => {
            let outStream;
            try {
                outStream = cacheFile.replace_finish(res);
            } catch (e) {
                done(e);
                return;
            }

            outStream.splice_async(
                stream,
                Gio.OutputStreamSpliceFlags.CLOSE_SOURCE |
                Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
                0, _cancellable, (s, res) => {
                    try {
                        outStream.splice_finish(res);
                    } catch (e) {
                        done(e);
                        return;
                    }

                    done();
                });
        });
    }

    function decode(buffer) {
        let decoder = new TextDecoder('utf8');
        return decoder.decode(buffer);
    }

    function _fetchCoverArtArchiveImage(uri, mbid, done) {
        let session = new Soup.Session();

        let message = Soup.Message.new('GET', uri);
        message.request_headers.append('User-Agent', 'gnome-sushi');

        session.send_async(message, 0, _cancellable, (r, res) => {
            let stream;
            try {
                stream = session.send_finish(res);
            } catch (e) {
                done(e, null);
                return;
            }

            _saveToCache(mbid, stream, (err) => {
                if (err)
                    console.warn(err, 'Unable to save cover to cache');
                _fetchFromCache(mbid, _cancellable, done);
            });
        });
    }

    function _fetchCoverArtArchiveMetadata(mbid, done) {
        let uri = Format.vprintf(COVER_ART_ARCHIVE_URL, [mbid]);
        let session = new Soup.Session();

        let message = Soup.Message.new('GET', uri);
        message.request_headers.append('User-Agent', 'gnome-sushi');
        session.send_and_read_async(message, 0, _cancellable, (r, res) => {
            try {
                let data = decode(session.send_and_read_finish(res).get_data());
                if (message.get_status() !== Soup.Status.OK)
                  return;

                let json_data = JSON.parse (data);

                let uri = json_data['images'][0]['thumbnails']['small'];
                _fetchCoverArtArchiveImage(uri, mbid, done);
                return;
            } catch (e) {
                done(e, null);
            }
        });
    }

    function _fetchFromMusicBrainz(done) {
        let artist = _tagList.get_string('artist')[1];
        let album = _tagList.get_string('album')[1];

        let uri = Format.vprintf(MUSIC_BRAINZ_ASIN_FORMAT, [album, artist]);
        let session = new Soup.Session();

        let message = Soup.Message.new('GET', uri);
        message.request_headers.append('User-Agent', 'gnome-sushi');

        session.send_and_read_async(message, 0, _cancellable, (r, res) => {
            let mbid = null;
            try {
                let data = decode(session.send_and_read_finish(res).get_data());
                if (message.get_status() !== Soup.Status.OK)
                    return;

                let json_response = JSON.parse(data);

                if (!('releases' in json_response) || json_response['releases'].length === 0)
                    return;

                mbid = json_response['releases'][0]['id'];
            } catch (e) {
              done (e, null);
              return;
            }

            _fetchFromCache(mbid, _cancellable, (err, cover) => {
                if (cover)
                    done(null, cover);
                else
                    _fetchCoverArtArchiveMetadata(mbid, done);
            });
        });
    }

   _fetchFromTags(_cancellable)
      .catch(() => null)
      .then(cover => {
        if (cover)
            _callback(null, cover);
        else
            _fetchFromMusicBrainz(_callback);
      });
}

export const Klass = class AudioRenderer extends Adw.Bin {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/audio.ui',
            InternalChildren: ['statusPage', 'mediaControls'],
        }, this);
    }

    constructor(file, _fileInfo, constructProperties = {}) {
        super(constructProperties);

        this._stream = Gtk.MediaFile.new_for_file(file);
        this._stream.play();
        this._mediaControls.set_media_stream(this._stream);

        this._coverFetched = false;

        this._coverPaintable = new CoverPaintable({ display: this.get_display() });
        this.bind_property(
            'scale-factor',
            this._coverPaintable,
            'scale-factor',
            GObject.BindingFlags.SYNC_CREATE);

        this._statusPage.set_paintable(this._coverPaintable);

        let disco = Sushi.Discoverer.new(file.get_uri());
        disco.connect('tags-changed', () => {
          let tag_list = disco.get_tag_list();
          if (tag_list)
            this._updateFromTags(tag_list);
        });

        this.cancellable = new Gio.Cancellable();
        this.cancellable.connect(() => this._coverPaintable.destroy());
        this.isReady();

        this.connect('unmap', () => (this._stream.pause()));
    }

    _setCover(cover) {
        this._coverPaintable.texture = cover;
    }

    _onCoverArtFetched(err, cover) {
        if (err) {
            if (!err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND) &&
                !err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.warn(err, 'Unable to fetch cover art');
            return;
        }

        this._setCover(cover);
    }

    _updateFromTags(tags) {
        let albumName = tags.get_string('album')[1];
        let artistName = tags.get_string('artist')[1];
        let titleName = tags.get_string('title')[1];

        if (!titleName) {
            let file = Gio.file_new_for_uri(this._player.file.get_uri());
            titleName = file.get_basename();
        }

        let description = ''

        if (artistName) {
            let escaped = GLib.markup_escape_text(artistName, -1);
            description += '<i>' + _("by") + '  </i><b>' + escaped + '</b>\n';
        }

        if (albumName) {
            let escaped = GLib.markup_escape_text(albumName, -1);
            description += '<i>' + _("from") + '  </i>' + escaped;
        }

        this._statusPage.set_title(titleName);
        this._statusPage.set_description(description);

        if (artistName && albumName && !this._coverFetched) {
            fetchCoverArt(tags, this.cancellable, this._onCoverArtFetched.bind(this));
            this._coverFetched = true;
        }
    }

    get resizePolicy() {
        return ResizePolicy.STATUS_PAGE;
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.FLAT;
    }
};

export const mimeTypes = TotemMimeTypes.audioTypes;
