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

    initialized() {
        this._rendererUnmapId = this.connect('unmap', () => {
            this.disconnect(this._rendererUnmapId);
            this._rendererUnmapId = 0;
            this.cleanup();
        });
    }

    isReady() {
        if (this._rendererUnmapId === undefined)
            this.initialized();
        this._ready = true;
        this.emit('ready');
    }

    cleanup() {
        // overwrite this function with cleanup code
    }

    get resizePolicy() {
        return ResizePolicy.MAX_SIZE;
    }

    get customSize() {
        // customSize needs to be overwritten for ResizePolicy.CUSTOM
        return null;
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.RAISED_BORDER;
    }

    get ready() {
        // intended to be called by main window
        return !!this._ready;
    }
}
