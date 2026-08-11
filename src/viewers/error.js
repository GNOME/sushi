
/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
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
        this._statusPage.set_description(this.#getSummary(error));

        this.markReady();
    }

    #getSummary(error) {
        const lines = this._error_msg.split('\n');

        if (lines.length > 1 && GLib.quark_to_string(error.domain) === 'gst-play-error-quark' && error.code === 1)
            return lines[1];
        else
            return `${lines[0]}${lines.length > 1 ? '…' : ''}`;
    }

    _copyFullError() {
        const clipboard = Gdk.Display.get_default()?.get_clipboard();
        clipboard?.set(this._error_msg);
    }

    get resizePolicy() {
        return ResizePolicy.STATUS_PAGE;
    }
}
