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

const {Gtk, GLib, GObject, Sushi, WebKit2} = imports.gi;

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
}, class HTMLRenderer extends WebKit2.WebView {
    _init(file) {
        super._init();

        let webContext = WebKit2.WebContext.get_default();
        webContext.set_sandbox_enabled(true);

        /* disable the default context menu of the web view */
        this.connect('context-menu',
                     function() {return true;});

        this.load_uri(file.get_uri());
        this.connect('load-failed', (view, loadEvent, uri, error) => {
            this.emit('error', error);
        });
        this.isReady();
    }

    get moveOnClick() {
        return false;
    }
});

var mimeTypes = [
    'text/html'
];
