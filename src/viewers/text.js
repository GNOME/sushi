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

const {Adw, Gdk, Gio, GLib, GObject, Gtk, GtkSource} = imports.gi;

const Renderer = imports.ui.renderer;

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
}, class TextRenderer extends Gtk.ScrolledWindow {
    get ready() {
        return !!this._ready;
    }

    get fullscreen() {
        return !!this._fullscreen;
    }

    _init(file, fileInfo) {
        super._init();

        this.cancellable = new Gio.Cancellable();

        let buffer = this._createBuffer(file, fileInfo);
        this._view = new GtkSource.View({ buffer: buffer,
                                          editable: false,
                                          cursor_visible: false,
                                          monospace: true,
                                          show_line_numbers: !!buffer.language });

        this.set_child(this._view);

        this.isReady();
    }

    _setStyle(adwStyleManager, buffer) {
        let sourceStyleManager = GtkSource.StyleSchemeManager.get_default();
        let scheme;
        if (adwStyleManager.dark)
          scheme = sourceStyleManager.get_scheme('Adwaita-dark');
        else
          scheme = sourceStyleManager.get_scheme('Adwaita');
        buffer.set_style_scheme(scheme);
    }

    _createBuffer(file, fileInfo) {
        let buffer = new GtkSource.Buffer();

        let adwStyleManager = Adw.StyleManager.get_default();
        adwStyleManager.connect('notify::dark', () => {
          this._setStyle(adwStyleManager, buffer);
        });
        this._setStyle(adwStyleManager, buffer);

        let langManager = GtkSource.LanguageManager.get_default();
        let language = langManager.guess_language(file.get_basename(),
                                                  fileInfo.get_content_type());
        if (language)
            buffer.set_language(language);

        let sourceFile = new GtkSource.File({ location: file });
        let loader = new GtkSource.FileLoader({ buffer: buffer,
                                                file: sourceFile });
        loader.load_async(0, this.cancellable, null, (loader, result) => {
            try {
                loader.load_finish(result);
            } catch (e) {
                if(!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    this.emit('error', e);
            }
        });

        return buffer;
    }
});

// register for text/plain and let the mime handler call us for child types
var mimeTypes = [
    'text/plain'
];
