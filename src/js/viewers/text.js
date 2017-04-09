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

const Gdk = imports.gi.Gdk;
const GtkClutter = imports.gi.GtkClutter;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const GtkSource = imports.gi.GtkSource;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Sushi = imports.gi.Sushi;

const MimeHandler = imports.ui.mimeHandler;
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

const TextRenderer = new Lang.Class({
    Name: 'TextRenderer',

    _init : function(args) {
        this.moveOnClick = false;
        this.canFullScreen = true;
    },

    prepare : function(file, mainWindow, callback) {
        this._mainWindow = mainWindow;
        this._file = file;
        this._callback = callback;

        let textLoader = new Sushi.TextLoader();
        textLoader.connect('loaded',
                           Lang.bind(this, this._onBufferLoaded));
        textLoader.uri = file.get_uri();
    },

    render : function() {
        return this._actor;
    },

    _onBufferLoaded : function(loader, buffer) {
        buffer.highlight_syntax = true;

        let styleManager = GtkSource.StyleSchemeManager.get_default();
        let geditScheme = _getGeditScheme();
        let scheme = styleManager.get_scheme(geditScheme);
        this._buffer.set_style_scheme(scheme);

        this._view = new GtkSource.View({ buffer: buffer,
                                          editable: false,
                                          cursor_visible: false,
                                          monospace: true });
        this._view.set_can_focus(false);

        if (buffer.get_language())
            this._view.set_show_line_numbers(true);

        this._view.connect('button-press-event', Lang.bind(this, function(view, event) {
            let [, button] = event.get_button();
            if (button == Gdk.BUTTON_SECONDARY)
                return true;

            return false;
        }));

        this._scrolledWin = new Gtk.ScrolledWindow();
        this._scrolledWin.add(this._view);
        this._scrolledWin.show_all();

        this._actor = new GtkClutter.Actor({ contents: this._scrolledWin });
        this._actor.set_reactive(true);
        this._callback();
    },

    getSizeForAllocation : function(allocation) {
        return allocation;
    },

    createToolbar : function() {
        this._mainToolbar = new Gtk.Toolbar({ icon_size: Gtk.IconSize.MENU });
        this._mainToolbar.get_style_context().add_class('osd');
        this._mainToolbar.set_show_arrow(false);

        this._toolbarRun = Utils.createOpenButton(this._file, this._mainWindow);
        this._mainToolbar.insert(this._toolbarRun, 0);

        this._mainToolbar.show();

        this._toolbarActor = new GtkClutter.Actor({ contents: this._mainToolbar });

        return this._toolbarActor;
    }
});

let handler = new MimeHandler.MimeHandler();
let renderer = new TextRenderer();

/* register for text/plain and let the mime handler call us
 * for child types.
 */
let mimeTypes = [
    'text/plain'
];

handler.registerMimeTypes(mimeTypes, renderer);
