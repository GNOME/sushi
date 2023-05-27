/*
 * Copyright (C) 2011 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 *
 * The Sushi project hereby grant permission for non-gpl compatible GStreamer
 * plugins to be used and distributed together with GStreamer and Sushi. This
 * permission is above and beyond the permissions granted by the GPL license
 * Sushi is covered by.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

const {Gdk, GdkPixbuf, Gio, GLib, GObject, Gst, GstTag, Gtk, Soup, Sushi} = imports.gi;

const Constants = imports.util.constants;
const Renderer = imports.ui.renderer;
const TotemMimeTypes = imports.util.totemMimeTypes;

function _formatTimeString(timeVal) {
    let hours = Math.floor(timeVal / 3600);
    timeVal -= hours * 3600;

    let minutes = Math.floor(timeVal / 60);
    timeVal -= minutes * 60;

    let seconds = Math.floor(timeVal);

    let str = ('%02d:%02d').format(minutes, seconds);
    if (hours > 0) {
        str = ('%d').format(hours) + ':' + str;
    }

    return str;
}

const COVER_ART_ARCHIVE_URL = "https://coverartarchive.org/release/%s";
const MUSIC_BRAINZ_ASIN_FORMAT = "https://musicbrainz.org/ws/2/release/?query=release:\"%s\"AND artist:\"%s\"&limit=1&fmt=json";
const fetchCoverArt = function(_tagList, _cancellable, _callback) {
    function _fetchFromTags() {
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
            if (type == GstTag.TagImageType.UNDEFINED) {
                coverSample = sample;
            } else if (type == GstTag.TagImageType.FRONT_COVER) {
                coverSample = sample;
                break;
            }
        }

        // Fallback to preview
        if (!coverSample)
            coverSample = _tagList.get_sample_index(Gst.TAG_PREVIEW_IMAGE, 0)[1];

        if (coverSample) {
            try {
                return Sushi.pixbuf_from_gst_sample(coverSample)
            } catch (e) {
                logError(e, 'Unable to fetch cover art from GstSample');
            }
        }
        return null;
    }

    function _getCacheFile(mbid) {
        let cachePath = GLib.build_filenamev([GLib.get_user_cache_dir(), 'sushi']);
        return Gio.File.new_for_path(GLib.build_filenamev([cachePath, `${mbid}.jpg`]));
    }

    function _fetchFromStream(stream, done) {
        GdkPixbuf.Pixbuf.new_from_stream_async(stream, _cancellable, (o, res) => {
            let cover;
            try {
                cover = GdkPixbuf.Pixbuf.new_from_stream_finish(res);
            } catch (e) {
                done(e, null);
                return;
            }

            done(null, cover);
        });
    }

    function _fetchFromCache(mbid, done) {
        let file = _getCacheFile(mbid);
        file.query_info_async(Gio.FILE_ATTRIBUTE_STANDARD_TYPE, 0, 0, _cancellable, (f, res) => {
            try {
                file.query_info_finish(res);
            } catch (e) {
                done(e, null);
                return;
            }

            file.read_async(0, _cancellable, (f, res) => {
                let stream;
                try {
                    stream = file.read_finish(res);
                } catch (e) {
                    done(e, null);
                    return;
                }

                _fetchFromStream(stream, done);
            });
        });
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
                    logError(err, 'Unable to save cover to cache');
                _fetchFromCache(mbid, done);
            });
        });
    }

    function _fetchCoverArtArchiveMetadata(mbid, done) {
        let uri = COVER_ART_ARCHIVE_URL.format(mbid);
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

        let uri = MUSIC_BRAINZ_ASIN_FORMAT.format(album, artist);
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

            _fetchFromCache(mbid, (err, cover) => {
                if (cover)
                    done(null, cover);
                else
                    _fetchCoverArtArchiveMetadata(mbid, done);
            });
        });
    }

   let cover = _fetchFromTags();
   if (cover) {
       _callback(null, cover);
       return;
   }

    _fetchFromMusicBrainz(_callback);
}

const AudioPlayer = GObject.registerClass({
    CssName: 'toolbar',
}, class AudioPlayer extends Sushi.MediaBin {
    _init(file) {
        super._init({ audio_mode: true,
                      uri: file.get_uri(),
                      margin_bottom: Constants.TOOLBAR_SPACING,
                      margin_start: Constants.TOOLBAR_SPACING,
                      margin_end: Constants.TOOLBAR_SPACING,
                      valign: Gtk.Align.END });
        this.get_style_context().add_class('osd');
    }
});

const COVER_SIZE = 256;
var Klass = GObject.registerClass({
    Implements: [Renderer.Renderer],
    Properties: {
        fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                              GObject.ParamFlags.READABLE,
                                              false),
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false)
    },
}, class AudioRenderer extends Gtk.Overlay {
    get ready() {
        return !!this._ready;
    }
    get fullscreen() {
        return !!this._fullscreen;
    }

    _init(file) {
        super._init();

        this._coverFetched = false;

        let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                spacing: 6 });
        this.add(box);

        this._player = new AudioPlayer(file);
        this._player.connect('tags-change', (p) => {
            this._updateFromTags(this._player.get_audio_tags());
        });
        this._player.connect('error', (p, error) => {
            this.emit('error', error);
            return false;
        });
        this.add_overlay(this._player);

        this._autoplayId = GLib.idle_add(0, () => {
            this._autoplayId = 0;
            this._player.play();
            return false;
        });

        let frame = new Gtk.Frame({ height_request: COVER_SIZE,
                                    width_request: COVER_SIZE,
                                    shadow_type: Gtk.ShadowType.NONE });
        box.pack_start(frame, false, false, 0);

        this._image = new Gtk.Image({ icon_name: 'media-optical-symbolic',
                                      pixel_size: COVER_SIZE });
        frame.add(this._image);

        let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                 spacing: 1,
                                 margin_top: 48,
                                 margin_start: 12,
                                 margin_end: 12 });
        box.pack_start(vbox, false, false, 0);

        this._titleLabel = new Gtk.Label();
        this._titleLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._titleLabel, false, false, 0);

        this._authorLabel = new Gtk.Label();
        this._authorLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._authorLabel, false, false, 0);

        this._albumLabel = new Gtk.Label();
        this._albumLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._albumLabel, false, false, 0);

        this.connect('destroy', this._onDestroy.bind(this));
        this._cancellable = new Gio.Cancellable();
        this.isReady();
    }

    _onDestroy() {
        if (this._autoplayId > 0) {
            GLib.source_remove(this._autoplayId);
            this._autoplayId = 0;
        }

        this._cancellable.cancel();
    }

    _setCover(cover) {
        let scaleFactor = this.get_scale_factor();
        let size = COVER_SIZE * scaleFactor;
        let width = cover.get_width();
        let height = cover.get_height();
        let targetWidth = size;
        let targetHeight = size;

        if (width > height)
            targetHeight = height * size / width;
        else
            targetWidth = width * size / height;

        let coverArt = cover.scale_simple(targetWidth, targetHeight,
                                          GdkPixbuf.InterpType.BILINEAR);
        let surface = Gdk.cairo_surface_create_from_pixbuf(coverArt, scaleFactor, this.get_window());
        this._image.set_from_surface(surface);
    }

    _onCoverArtFetched(err, cover) {
        if (err) {
            if (!err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND) &&
                !err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                logError(err, 'Unable to fetch cover art');
            return;
        }

        this._setCover(cover);
    }

    _updateFromTags(tags) {
        let albumName = tags.get_string('album')[1];
        let artistName = tags.get_string('artist')[1];
        let titleName = tags.get_string('title')[1];

        if (!titleName) {
            let file = Gio.file_new_for_uri(this._player.uri);
            titleName = file.get_basename();
        }

        if (albumName) {
            let escaped = GLib.markup_escape_text(albumName, -1);
            this._albumLabel.set_markup('<small><i>' + _("from") + '  </i>' + escaped + '</small>');
        }

        if (artistName) {
            let escaped = GLib.markup_escape_text(artistName, -1);
            this._authorLabel.set_markup('<small><i>' + _("by") + '  </i><b>' + escaped + '</b></small>');
        }

        let escaped = GLib.markup_escape_text(titleName, -1);
        this._titleLabel.set_markup('<b>' + escaped + '</b>');

        if (artistName && albumName && !this._coverFetched) {
            fetchCoverArt(tags, this._cancellable, this._onCoverArtFetched.bind(this));
            this._coverFetched = true;
        }
    }

    get hasToolbar() {
        // SushiMediaBin uses its own toolbar
        return false;
    }

    get resizable() {
        return false;
    }

    get resizePolicy() {
        return Renderer.ResizePolicy.NAT_SIZE;
    }
});

var mimeTypes = TotemMimeTypes.audioTypes;
