/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
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
        }, this);
    }

    constructor(file, _fileInfo, constructProperties = {}) {
        super(constructProperties);

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
