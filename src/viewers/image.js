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

const {Gdk, Gio, GLib, GObject, Gtk, Gly, GlyGtk4} = imports.gi;
import {Renderer, ResizePolicy} from '../core/renderer.js';

Gio._promisify(Gly.Loader.prototype, 'load_async', 'load_finish');
Gio._promisify(Gly.Image.prototype, 'next_frame_async', 'next_frame_finish');

export const Klass = GObject.registerClass({
    Implements: [Renderer],
    Properties: {
        fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                              GObject.ParamFlags.READABLE,
                                              false),
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false)
    },
}, class ImageRenderer extends Gtk.Picture {
    get ready() {
        return !!this._ready;
    }

    get fullscreen() {
        return !!this._fullscreen;
    }

    _init(file) {
        super._init();
        this.cancellable = new Gio.Cancellable();
        this._loadFile(file)
            .then(() => this.isReady())
            .catch(error => this.emit('error', error));
    }

    async _loadFile(file) {
        const loader = Gly.Loader.new(file);
        const image = loader.load();
        this._imageWidth = image.get_width();
        this._imageHeight = image.get_height();
        this.queue_resize();
        const frame = await image.next_frame_async(this.cancellable);
        const texture = GlyGtk4.frame_get_texture(frame);
        this._texture = texture;
        this.content_fit = Gtk.ContentFit.SCALE_DOWN;
        this.set_paintable(texture);
    }

    vfunc_measure(orientation, for_size) {
        if (orientation == Gtk.Orientation.VERTICAL)
          return [1, this._texture?.get_height() ?? this._imageHeight ?? 1, -1, -1];
        else
          return [1, this._texture?.get_width() ?? this._imageWidth ?? 1, -1, -1];
    }

    get resizePolicy() {
        return ResizePolicy.SCALED;
    }
});

export const mimeTypes = Gly.Loader.get_mime_types();
