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

const Sushi = imports.gi.Sushi;

const Lang = imports.lang;

const MimeHandler = imports.ui.mimeHandler;
const TotemMimeTypes = imports.util.totemMimeTypes;
const Utils = imports.ui.utils;

const GstRenderer = new Lang.Class({
    Name: 'GstRenderer',

    _init : function(args) {
        this.moveOnClick = true;
        // fullscreen is handled internally by the widget
        this.canFullScreen = false;
    },

    prepare : function(file, mainWindow, callback) {
        this._player = new Sushi.MediaBin({ uri: file.get_uri() });
        this._player.play();
        this._player.connect('size-change', function() {
            mainWindow.refreshSize();
        });
        callback();
    },

    render : function() {
        return this._player;
    },

    clear : function() {
        this._player.stop();
    },

    getSizeForAllocation : function(allocation) {
        let baseSize = [this._player.get_preferred_width()[1],
                        this._player.get_preferred_height()[1]];
        return Utils.getScaledSize(baseSize, allocation, true);
    }
});

let handler = new MimeHandler.MimeHandler();
let renderer = new GstRenderer();

handler.registerMimeTypes(TotemMimeTypes.videoTypes, renderer);
