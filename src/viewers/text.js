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

const {Gdk, Gio, GLib, GObject, Gtk, GtkSource} = imports.gi;

const Renderer = imports.ui.renderer;
const Utils = imports.ui.utils;

function _getGeditScheme() {
    let geditScheme = 'tango';
    let schemaName = 'org.gnome.gedit.preferences.editor';
    let installedSchemas = Gio.Settings.list_schemas();
    if (installedSchemas.indexOf(schemaName) > -1) {
        let geditSettings = new Gio.Settings({ schema: schemaName });
        let geditSchemeName = geditSettings.get_string('scheme');
        if (geditSchemeName != '')
            geditScheme = geditSchemeName;
    }

    return geditScheme;
}

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
    _init(file, fileInfo) {
        super._init();

        let buffer = this._createBuffer(file, fileInfo);
        this._view = new GtkSource.View({ buffer: buffer,
                                          editable: false,
                                          cursor_visible: false,
                                          monospace: true,
                                          show_line_numbers: !!buffer.language });
        this._view.set_can_focus(false);
        this._view.connect('button-press-event', (view, event) => {
            let [, button] = event.get_button();
            if (button == Gdk.BUTTON_SECONDARY)
                return true;

            return false;
        });

        this.add(this._view);
        this.isReady();
    }

    _createBuffer(file, fileInfo) {
        let buffer = new GtkSource.Buffer();
        let styleManager = GtkSource.StyleSchemeManager.get_default();
        let geditScheme = _getGeditScheme();
        let scheme = styleManager.get_scheme(geditScheme);
        buffer.set_style_scheme(scheme);

        let langManager = GtkSource.LanguageManager.get_default();
        let language = langManager.guess_language(file.get_basename(),
                                                  fileInfo.get_content_type());
        if (language)
            buffer.set_language(language);

        let sourceFile = new GtkSource.File({ location: file });
        let loader = new GtkSource.FileLoader({ buffer: buffer,
                                                file: sourceFile });
        loader.load_async(0, null, null, (loader, result) => {
            try {
                loader.load_finish(result);
            } catch (e) {
                logError(e, `Unable to load the text file at ${loader.location.get_uri()}`);
            }
        });

        return buffer;
    }

    get moveOnClick() {
        return false;
    }
});

// register for text/plain and let the mime handler call us for child types
var mimeTypes = [
    'text/plain'
];
