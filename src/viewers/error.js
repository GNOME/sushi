
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

    constructor(error, constructProperties = {}) {
        super(constructProperties);

        this._error_msg = error.message.trim();
        const index = this._error_msg.indexOf('\n');
        const hasMultipleLines = index >= 0;
        const first_line = hasMultipleLines
            ? this._error_msg.substring(0, index)
            : this._error_msg;

        this._statusPage.set_description(first_line + (hasMultipleLines ? '…' : ''));

        this.isReady();
    }

    _copyFullError() {
        const clipboard = Gdk.Display.get_default()?.get_clipboard();
        clipboard?.set(this._error_msg);
    }

    get resizePolicy() {
        return ResizePolicy.STATUS_PAGE;
    }
}
