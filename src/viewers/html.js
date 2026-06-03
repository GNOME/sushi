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

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Sushi from 'gi://Sushi';

let WebKit = undefined;
try {
    WebKit = (await import('gi://WebKit?version=6.0')).default;
} catch(e) {
}

function _isAvailable() {
    return WebKit !== undefined;
}

import {Renderer} from '../core/renderer.js';

export const Klass = _isAvailable() ? class HTMLRenderer extends WebKit.WebView {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Properties: {
                fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                                      GObject.ParamFlags.READABLE,
                                                      false),
                ready: GObject.ParamSpec.boolean('ready', '', '',
                                                 GObject.ParamFlags.READABLE,
                                                 false)
            },
        }, this);
    }

    get ready() {
        return !!this._ready;
    }

    get fullscreen() {
        return !!this._fullscreen;
    }

    _init(file) {
        super._init();

        /* disable the default context menu of the web view */
        this.connect('context-menu',
                     function() {return true;});

        this.load_uri(file.get_uri());
        this.connect('load-failed', (view, loadEvent, uri, error) => {
            this.emit('error', error);
        });
        this.isReady();
    }
} : undefined;

export const mimeTypes = _isAvailable() ? ['text/html'] : [];
