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

Gio._promisify(Gio.File.prototype, 'replace_async', 'replace_finish');
Gio._promisify(Gio.FileOutputStream.prototype, 'splice_async', 'splice_finish');
Gio._promisify(Gly.Loader.prototype, 'load_async', 'load_finish');
Gio._promisify(Gly.Image.prototype, 'next_frame_async', 'next_frame_finish');
Gio._promisify(Soup.Session.prototype, 'send_async', 'send_finish');
Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

const COVER_ART_ARCHIVE_URL = 'https://coverartarchive.org/release/%s';
const MUSIC_BRAINZ_ASIN_FORMAT = 'https://musicbrainz.org/ws/2/release/?query=release:"%s"AND artist:"%s"&limit=1&fmt=json';
const fetchCoverArt = (_tagList, _cancellable) => {
    function _fetchFromTags(cancellable) {
        let coverSample = null;
        let idx = 0;

        while (true) {
            const [res, sample] = _tagList.get_sample_index(Gst.TAG_IMAGE, idx);
            if (!res)
                break;

            idx++;

            const caps = sample.get_caps();
            const capsStruct = caps.get_structure(0);
            const [, type] = capsStruct.get_enum('image-type', GstTag.TagImageType.$gtype);
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

        if (coverSample)
            return _fetchFromGstSample(coverSample, cancellable);
        else
            return Promise.reject(new Error('No cover art tag'));
    }

    function _getCacheFile(mbid) {
        const cachePath = GLib.build_filenamev([GLib.get_user_cache_dir(), 'sushi']);
        return Gio.File.new_for_path(GLib.build_filenamev([cachePath, `${mbid}.jpg`]));
    }

    function _fetchFromFile(file, cancellable) {
        const loader = Gly.Loader.new(file);
        return loader.load_async(cancellable)
            .then(image => image.next_frame_async(cancellable))
            .then(frame => GlyGtk4.frame_get_texture(frame));
    }

    function _fetchFromGstSample(sample, cancellable) {
        const buffer = sample.get_buffer();
        const [ok, info] = buffer.map(Gst.MapFlags.READ);
        if (!ok)
            return Promise.reject(new Error('Failed to map GstBuffer'));
        const bytes = GLib.Bytes.new(info.data);
        const loader = Gly.Loader.new_for_bytes(bytes);
        return loader.load_async(cancellable)
            .then(image => image.next_frame_async(cancellable))
            .then(frame => GlyGtk4.frame_get_texture(frame));
    }

    function _fetchFromCache(mbid, cancellable) {
        const file = _getCacheFile(mbid);
        return _fetchFromFile(file, cancellable);
    }

    function _saveToCache(mbid, stream) {
        let streamToClose = null;
        const cacheFile = _getCacheFile(mbid);
        const cachePath = cacheFile.get_parent().get_path();
        GLib.mkdir_with_parents(cachePath, 448);

        return cacheFile.replace_async(null, false, Gio.FileCreateFlags.PRIVATE, 0, _cancellable)
            .then(outStream => {
                streamToClose = outStream;
                return outStream.splice_async(
                    stream,
                    Gio.OutputStreamSpliceFlags.CLOSE_SOURCE |
                    Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
                    0, _cancellable);
            })
            .then(_ => streamToClose.close(_cancellable));
    }

    function decode(buffer) {
        const decoder = new TextDecoder('utf8');
        return decoder.decode(buffer);
    }

    function _fetchCoverArtArchiveImage(uri, mbid) {
        const session = new Soup.Session();

        const message = Soup.Message.new('GET', uri);
        message.request_headers.append('User-Agent', 'gnome-sushi');

        return session.send_async(message, 0, _cancellable)
            .then(stream => _saveToCache(mbid, stream))
            .catch(error => {
                console.warn(error, 'Unable to save cover to cache');
                return error;
            })
            .then(_ => _fetchFromCache(mbid, _cancellable));
    }

    function _fetchCoverArtArchiveMetadata(mbid) {
        const uri = Format.vprintf(COVER_ART_ARCHIVE_URL, [mbid]);
        const session = new Soup.Session();

        const message = Soup.Message.new('GET', uri);
        message.request_headers.append('User-Agent', 'gnome-sushi');
        return session.send_and_read_async(message, 0, _cancellable)
            .then(raw_data => {
                const data = decode(raw_data.get_data());
                if (message.get_status() !== Soup.Status.OK)
                    return Promise.reject(new Error('Art archive cover fetch failed'));

                const json_data = JSON.parse(data);

                const uri = json_data['images'][0]['thumbnails']['small'];
                return _fetchCoverArtArchiveImage(uri, mbid);
            });
    }

    function _fetchFromMusicBrainz() {
        const artist = _tagList.get_string('artist')[1];
        const album = _tagList.get_string('album')[1];

        if (!artist || !album)
            return Promise.reject(new Error('Not enough metadata to lookup file'));

        const uri = Format.vprintf(MUSIC_BRAINZ_ASIN_FORMAT, [album, artist]);
        const session = new Soup.Session();

        const message = Soup.Message.new('GET', uri);
        message.request_headers.append('User-Agent', 'gnome-sushi');

        return session.send_and_read_async(message, 0, _cancellable)
            .then(raw_data => {
                const data = decode(raw_data.get_data());
                if (message.get_status() !== Soup.Status.OK)
                    return Promise.reject(new Error('Musicbrainz lookup failed'));

                const json_response = JSON.parse(data);

                if (!('releases' in json_response) || json_response['releases'].length === 0)
                    return Promise.reject(new Error('Musicbrainz: Unknown release'));

                const mbid = json_response['releases'][0]['id'];

                return _fetchFromCache(mbid, _cancellable)
                    .catch(_ => _fetchCoverArtArchiveMetadata(mbid));
            });
    }

    return _fetchFromTags(_cancellable)
        .catch(error => {
            if (!error.hasOwnProperty('matches') ||
                !error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return _fetchFromMusicBrainz();
        })
        .catch(error => console.warn(`Couldn't retrieve cover art: ${error}`));
};

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

        this._coverPaintable = new CoverPaintable({display: this.get_display()});
        this.bind_property(
            'scale-factor',
            this._coverPaintable,
            'scale-factor',
            GObject.BindingFlags.SYNC_CREATE);

        this._statusPage.set_paintable(this._coverPaintable);

        const disco = Sushi.Discoverer.new(file.get_uri());
        disco.connect_object(
            'tags-changed',
            () => {
                const tag_list = disco.get_tag_list();
                if (tag_list)
                    this._updateFromTags(tag_list);
            },
            this, GObject.ConnectFlags.DEFAULT
        );

        this.isReady();
    }

    stop() {
        this._stream.clear();
        this._coverPaintable.destroy();
    }

    _updateFromTags(tags) {
        const albumName = tags.get_string('album')[1];
        const artistName = tags.get_string('artist')[1];
        let titleName = tags.get_string('title')[1];

        if (!titleName) {
            const file = Gio.file_new_for_uri(this._stream.file.get_uri());
            titleName = file.get_basename();
        }

        let description = '';

        if (artistName) {
            const escaped = GLib.markup_escape_text(artistName, -1);
            description += `<i>${_('by')}  </i><b>${escaped}</b>\n`;
        }

        if (albumName) {
            const escaped = GLib.markup_escape_text(albumName, -1);
            description += `<i>${_('from')}  </i>${escaped}`;
        }

        this._statusPage.set_title(titleName);
        this._statusPage.set_description(description);

        if (!this._coverFetched) {
            this._coverFetched = true;
            fetchCoverArt(tags, this.getCancellable())
                .then(cover => {
                    this._coverPaintable.texture = cover;
                })
                .catch(error => {
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND) &&
                        !error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        console.warn(error, 'Unable to fetch cover art');
                });
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
