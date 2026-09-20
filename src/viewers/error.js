
/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';

import {Renderer, ResizePolicy} from '../core/renderer.js';

export class ErrorRenderer extends Adw.Bin {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/error.ui',
            InternalChildren: ['statusPage'],
        }, this);
    }

    #error;

    constructor(error, constructProperties = {}) {
        super(constructProperties);

        this.#error = error;
        this._statusPage.set_description(this.#error.summary);

        this.markReady();
    }

    _copyFullError() {
        const clipboard = Gdk.Display.get_default()?.get_clipboard();
        clipboard?.set(this.#error.message);
    }

    get resizePolicy() {
        return ResizePolicy.STATUS_PAGE;
    }
}
