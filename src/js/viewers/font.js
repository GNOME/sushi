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

const {GLib, GObject, Gtk, Sushi} = imports.gi;

const MimeHandler = imports.ui.mimeHandler;
const Renderer = imports.ui.renderer;

const FontRenderer = GObject.registerClass(class FontRenderer extends Sushi.FontWidget {
    _init(file, mainWindow) {
        super._init({ uri: file.get_uri(),
                      visible: true })

        this.moveOnClick = true;
        this.canFullScreen = true;
        this._file = file;
    }

    get resizePolicy() {
        return Renderer.ResizePolicy.MAX_SIZE;
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
