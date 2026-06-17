/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors */

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

export const ResizePolicy = {
    MAX_SIZE: 0,
    NAT_SIZE: 1,
    SCALED: 2,
    STATUS_PAGE: 3,
};

export class Renderer extends GObject.Interface {
    static {
        GObject.registerClass({
            Requires: [Gtk.Widget],
            Properties: {
                ready: GObject.ParamSpec.boolean('ready', '', '',
                                                 GObject.ParamFlags.READABLE,
                                                 false)
            },
            Signals: {
                'error': { param_types: [GLib.Error.$gtype] }
            }
        }, this);
    }

    isReady() {
        this._ready = true;
        this.notify('ready');
    }

    get ready() {
        return !!this._ready;
    }

    get resizePolicy() {
        return ResizePolicy.MAX_SIZE;
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.RAISED_BORDER;
    }
}
