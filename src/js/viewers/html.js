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

const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Sushi = imports.gi.Sushi;
const WebKit = imports.gi.WebKit2;

const MimeHandler = imports.ui.mimeHandler;
const Utils = imports.ui.utils;

const HTMLRenderer = new Lang.Class({
    Name: 'HTMLRenderer',

    _init : function(args) {
        this.moveOnClick = false;
        this.canFullScreen = true;
    },

    render : function(file, mainWindow) {
        this._mainWindow = mainWindow;
        this._file = file;

        this._webView = new WebKit.WebView();
        this._webView.show_all();

        /* disable the default context menu of the web view */
        this._webView.connect ("context-menu",
                               function() {return true;});

        this._webView.load_uri(file.get_uri());

        return this._webView;
    },

    getSizeForAllocation : function(allocation) {
        return allocation;
    },

    populateToolbar : function(toolbar) {
        let toolbarZoom = Utils.createFullScreenButton(this._mainWindow);
        toolbar.insert(toolbarZoom, 0);

        let separator = new Gtk.SeparatorToolItem();
        separator.show();
        toolbar.insert(separator, 1);

        let toolbarRun = Utils.createOpenButton(this._file, this._mainWindow);
        toolbar.insert(toolbarRun, 2);
    }
});

let handler = new MimeHandler.MimeHandler();
let renderer = new HTMLRenderer();

let mimeTypes = [
    'text/html'
];

handler.registerMimeTypes(mimeTypes, renderer);
