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

const {GLib, GObject, Sushi} = imports.gi;

const Renderer = imports.ui.renderer;
const TotemMimeTypes = imports.util.totemMimeTypes;

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
}, class GstRenderer extends Sushi.MediaBin {
    get ready() {
        return !!this._ready;
    }

    get fullscreen() {
        return !!this._fullscreen;
    }

    _init(file) {
        super._init({ uri: file.get_uri() });

        this._autoplayId = GLib.idle_add(0, () => {
            this._autoplayId = 0;
            this.play();
            return false;
        });

        this.connect('destroy', this._onDestroy.bind(this));
        this.connect('size-change', this.isReady.bind(this));
    }

    _onDestroy() {
        if (this._autoplayId > 0) {
            GLib.source_remove(this._autoplayId);
            this._autoplayId = 0;
        }
    }

    get canFullscreen() {
        // fullscreen is handled internally by the widget
        return false;
    }

    get hasToolbar() {
        // SushiMediaBin uses its own toolbar
        return false;
    }

    get resizePolicy() {
        return Renderer.ResizePolicy.STRETCHED;
    }
});

var mimeTypes = TotemMimeTypes.videoTypes;
