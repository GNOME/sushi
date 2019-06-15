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

const {GdkPixbuf, Gio, GObject, Gst, Gtk, Sushi} = imports.gi;

const Constants = imports.util.constants;
const Renderer = imports.ui.renderer;
const TotemMimeTypes = imports.util.totemMimeTypes;
const Utils = imports.ui.utils;

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

var Klass = GObject.registerClass({
    Implements: [Renderer.Renderer],
    Properties: {
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false)
    },
}, class AudioRenderer extends Gtk.Box {
    _init(file, mainWindow) {
        super._init({ orientation: Gtk.Orientation.HORIZONTAL,
                      spacing: 6 });

        this.moveOnClick = true;
        this.canFullScreen = false;

        this._mainWindow = mainWindow;
        this._file = file;

        this._createPlayer(file);

        this._image = new Gtk.Image({ icon_name: 'media-optical-symbolic',
                                      pixel_size: 256 });
        this.pack_start(this._image, false, false, 0);

        let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                 spacing: 1,
                                 margin_top: 48,
                                 margin_start: 12,
                                 margin_end: 12 });
        this.pack_start(vbox, false, false, 0);

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
        this.isReady();
    }

    _createPlayer(file) {
        this._playerNotifies = [];

        this._player = new Sushi.SoundPlayer({ uri: file.get_uri() });
        this._player.playing = true;

        this._playerNotifies.push(
            this._player.connect('notify::progress', this._onPlayerProgressChanged.bind(this)));
        this._playerNotifies.push(
            this._player.connect('notify::duration', this._onPlayerDurationChanged.bind(this)));
        this._playerNotifies.push(
            this._player.connect('notify::state', this._onPlayerStateChanged.bind(this)));
        this._playerNotifies.push(
            this._player.connect('notify::taglist', this._onTagListChanged.bind(this)));
        this._playerNotifies.push(
            this._player.connect('notify::cover', this._onCoverArtChanged.bind(this)));
    }

    _onDestroy() {
        this._playerNotifies.forEach((id) => this._player.disconnect(id));
        this._playerNotifies = [];
        this._player.playing = false;
        this._player = null;
    }

    _ensurePixbufSize(cover) {
        let width, height;

        width = cover.get_width();
        height = cover.get_height();

        if (width > 256 ||
            height > 256) {
            if (width > height) {
                this._coverArt = cover.scale_simple(256,
                                                    height * 256 / width,
                                                    GdkPixbuf.InterpType.BILINEAR);
            } else {
                this._coverArt = cover.scale_simple(width * 256 / height,
                                                    256,
                                                    GdkPixbuf.InterpType.BILINEAR);
            }
        } else {
            this._coverArt = cover;
        }
    }

    _onCoverArtChanged() {
        if (!this._artFetcher.cover) {
            this._image.set_from_icon_name('media-optical-symbolic');
            return;
        }

        this._ensurePixbufSize(this._artFetcher.cover);
        this._image.set_from_pixbuf(this._coverArt);
    }

    _onTagListChanged() {
        let tags = this._player.taglist;
        let albumName = tags.get_string('album')[1];
        let artistName = tags.get_string('artist')[1];
        let titleName = tags.get_string('title')[1];
        let haveTitleTag = true;

        if (!titleName) {
            let file = Gio.file_new_for_uri(this._player.uri);
            titleName = file.get_basename();
            haveTitleTag = false;
        }

        if (albumName)
            this._albumLabel.set_markup('<small><i>' + _("from") + '  </i>' + albumName + '</small>');
        if (artistName)
            this._authorLabel.set_markup('<small><i>' + _("by") + '  </i><b>' + artistName + '</b></small>');

        this._titleLabel.set_markup('<b>' + titleName + '</b>');

        let windowTitle = '';

        if (artistName && haveTitleTag)
            windowTitle = artistName + ' - ' + titleName;
        else
            windowTitle = titleName;

        this._mainWindow.setTitle(windowTitle);

        this._artFetcher = new Sushi.CoverArtFetcher();
        this._artFetcher.connect('notify::cover', this._onCoverArtChanged.bind(this));
        this._artFetcher.taglist = tags;
    }

    _updateProgressBar() {
        if (!this._progressBar)
            return;

        this._isSettingValue = true;
        this._progressBar.set_value(this._player.progress * 1000);
        this._isSettingValue = false;
    }

    _updateCurrentLabel() {
        if (!this._currentLabel)
            return;

        let currentTime =
            Math.floor(this._player.duration * this._player.progress);

        this._currentLabel.set_text(_formatTimeString(currentTime));
    }

    _updateDurationLabel() {
        if (!this._durationLabel)
            return;

        let totalTime = this._player.duration;

        this._durationLabel.set_text(_formatTimeString(totalTime));
    }

    _onPlayerProgressChanged() {
        this._updateProgressBar();
        this._updateCurrentLabel();
    }

    _onPlayerDurationChanged() {
        this._updateDurationLabel();
    }

    _onPlayerStateChanged() {
        switch(this._player.state) {
        case Sushi.SoundPlayerState.PLAYING:
            this._toolbarPlay.image.set_from_icon_name('media-playback-pause-symbolic', Gtk.IconSize.MENU);
            break;
        default:
            let iconName = 'media-playback-start-symbolic';
            this._toolbarPlay.image.set_from_icon_name(iconName, Gtk.IconSize.MENU);
        }
    }

    get resizePolicy() {
        return Renderer.ResizePolicy.NAT_SIZE;
    }

    populateToolbar(toolbar) {
        this._toolbarPlay = Utils.createToolButton('media-playback-pause-symbolic', () => {
            let playing = !this._player.playing;
            this._player.playing = playing;
        });
        toolbar.add(this._toolbarPlay);

        this._currentLabel = new Gtk.Label({ margin_start: 6,
                                             margin_end: 3 });
        toolbar.add(this._currentLabel);

        this._progressBar =
            Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL,
                                     0, 1000, 10);
        this._progressBar.set_value(0);
        this._progressBar.set_draw_value(false);
        this._progressBar.connect('value-changed', () => {
            if(!this._isSettingValue)
                this._player.progress = this._progressBar.get_value() / 1000;
        });
        this._progressBar.set_size_request(200, -1);
        toolbar.add(this._progressBar);

        this._durationLabel = new Gtk.Label({ margin_start: 3 });
        toolbar.add(this._durationLabel);
    }
});

var mimeTypes = TotemMimeTypes.audioTypes;
