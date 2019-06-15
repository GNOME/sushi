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

imports.gi.versions.GtkSource = '4';

const {Gdk, Gio, GLib, GObject, Gtk, GtkSource, Sushi} = imports.gi;

const MimeHandler = imports.ui.mimeHandler;
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

const TextRenderer = GObject.registerClass(class TextRenderer extends Gtk.ScrolledWindow {
    _init(file, mainWindow) {
        super._init();

        this.moveOnClick = false;
        this.canFullScreen = true;
        this._mainWindow = mainWindow;
        this._file = file;

        let textLoader = new Sushi.TextLoader();
        textLoader.connect('loaded', this._onBufferLoaded.bind(this));
        textLoader.uri = file.get_uri();

        this._view = new GtkSource.View({ editable: false,
                                          cursor_visible: false,
                                          monospace: true });
        this._view.set_can_focus(false);
        this._view.connect('button-press-event', (view, event) => {
            let [, button] = event.get_button();
            if (button == Gdk.BUTTON_SECONDARY)
                return true;

            return false;
        });

        this.add(this._view);
    }

    _onBufferLoaded(loader, buffer) {
        buffer.highlight_syntax = true;

        let styleManager = GtkSource.StyleSchemeManager.get_default();
        let geditScheme = _getGeditScheme();
        let scheme = styleManager.get_scheme(geditScheme);
        buffer.set_style_scheme(scheme);

        this._view.set_buffer(buffer);
        if (buffer.get_language())
            this._view.set_show_line_numbers(true);
    }

    get resizePolicy() {
        return Renderer.ResizePolicy.MAX_SIZE;
    }

    populateToolbar(toolbar) {
        let toolbarRun = Utils.createOpenButton(this._file, this._mainWindow);
        toolbar.add(toolbarRun);
    }
});

let handler = new MimeHandler.MimeHandler();

/* register for text/plain and let the mime handler call us
 * for child types.
 */
let mimeTypes = [
    'text/plain'
];

handler.registerMimeTypes(mimeTypes, TextRenderer);
