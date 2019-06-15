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

const MimeHandler = imports.ui.mimeHandler;

const Lang = imports.lang;

const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Sushi = imports.gi.Sushi;

const FontRenderer = new Lang.Class({
    Name: 'FontRenderer',
    Extends: Sushi.FontWidget,

    _init : function(file, mainWindow) {
        this.parent({ uri: file.get_uri(),
                      visible: true })

        this.moveOnClick = true;
        this.canFullScreen = true;
        this._file = file;
    },

    getSizeForAllocation : function(allocation) {
        let size = [ this.get_preferred_size()[1].width,
                     this.get_preferred_size()[1].height ];

        if (size[0] > allocation[0])
            size[0] = allocation[0];

        if (size[1] > allocation[1])
            size[1] = allocation[1];

        return size;
    }
});

let handler = new MimeHandler.MimeHandler();

let mimeTypes = [
    'application/x-font-ttf',
    'application/x-font-otf',
    'application/x-font-pcf',
    'application/x-font-type1'
];

handler.registerMimeTypes(mimeTypes, FontRenderer);
