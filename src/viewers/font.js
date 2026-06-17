/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Sushi from 'gi://Sushi';

import {Renderer} from '../core/renderer.js';

export const Klass = class FontRenderer extends Sushi.FontWidget {
    static {
        GObject.registerClass({
            Implements: [Renderer],
        }, this);
    }

    _init(file) {
        super._init({ uri: file.get_uri(),
                      visible: true });

        this.isReady();
    }
};

export const mimeTypes = [
    'application/x-font-ttf',
    'application/x-font-otf',
    'application/x-font-pcf',
    'application/x-font-type1'
];
