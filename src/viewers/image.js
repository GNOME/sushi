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

const {Gdk, GdkPixbuf, GLib, GObject, Gtk} = imports.gi;

const Renderer = imports.ui.renderer;

var Klass = GObject.registerClass({
    Implements: [Renderer.Renderer],
    Properties: {
        fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                              GObject.ParamFlags.READABLE,
                                              false),
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false),
        width: GObject.ParamSpec.int('width', '', '',
                                         GObject.ParamFlags.READWRITE,
                                         1, 9999, 1),
        height: GObject.ParamSpec.int('height', '', '',
                                         GObject.ParamFlags.READWRITE,
                                         1, 9999, 1),
    },
}, class ImageRenderer extends Gtk.Picture {
    get ready() {
        return !!this._ready;
    }

    get fullscreen() {
        return !!this._fullscreen;
    }

    get height() {
      return this._texture ? this._texture.get_intrinsic_height() : 1;
    }

    get width() {
      return this._texture ? this._texture.get_intrinsic_width() : 1;
    }

    _init(file) {
        super._init();

        try {
          this._texture = Gdk.Texture.new_from_file(file);
          this.set_paintable(this._texture);
          this.content_fit = Gtk.ContentFit.SCALE_DOWN;
        }
        catch (e) {
          logError(e, 'Error loading image');
        }
    }

    get resizePolicy() {
        return Renderer.ResizePolicy.SCALED;
    }

});

var mimeTypes = [];
let formats = GdkPixbuf.Pixbuf.get_formats();
for (let idx in formats)
    mimeTypes = mimeTypes.concat(formats[idx].get_mime_types());
