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
    CUSTOM: 4,
};

export class Renderer extends GObject.Interface {
    static {
        GObject.registerClass({
            Requires: [Gtk.Widget],
            Signals: {
                'error': {param_types: [GLib.Error.$gtype]},
                'ready': {param_types: []},
            },
        }, this);
    }

    isReady() {
        this._ready = true;
        this.emit('ready');
    }

    get customSize() {
        // customSize needs to be overwritten for ResizePolicy.CUSTOM
        console.error('ResizePolicy programming error');
        return [1, 1];
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
