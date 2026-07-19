/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
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

    /* Methods called by subclasses */

    getCancellable() {
        if (this._rendererCancellable === undefined)
            this._rendererCancellable = new Gio.Cancellable();
        return this._rendererCancellable;
    }

    initialized() {
        const cancellable = this.getCancellable();
        this._rendererUnmapId = this.connect('unmap', () => {
            this.disconnect(this._rendererUnmapId);
            this._rendererUnmapId = 0;

            if (!cancellable.is_cancelled())
                this.stopRenderer();
            this.cleanup();
        });
    }

    isReady() {
        if (this._rendererUnmapId === undefined)
            this.initialized();
        this._ready = true;
        this.emit('ready');
    }

    /* Virtual methods, overridable by subclasses */

    stop() {
        // override this function with code to stop e.g. running animations
    }

    cleanup() {
        // override this function with cleanup code
    }

    get resizePolicy() {
        return ResizePolicy.MAX_SIZE;
    }

    get customSize() {
        // customSize needs to be overridden for ResizePolicy.CUSTOM
        return null;
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.FLAT;
    }

    get ready() {
        // intended to be called by main window
        return !!this._ready;
    }

    /* Public methods, intended to be called by main window */

    getSize(maxSize) {
        const rendererSize = this.get_preferred_size();
        const natSize = [rendererSize[1].width, rendererSize[1].height];

        switch (this.resizePolicy) {
        case ResizePolicy.CUSTOM: {
            const customSize = this.customSize;
            if (customSize) {
                return customSize;
            } else {
                console.error('ResizePolicy programming error');
                return maxSize;
            }
        }
        case ResizePolicy.MAX_SIZE:
            return maxSize;
        case ResizePolicy.NAT_SIZE:
            return natSize;
        case ResizePolicy.SCALED:
            if (natSize[0] <= maxSize[0] && natSize[1] <= maxSize[1]) {
                // no scaling needed
                return natSize;
            } else {
                // scale by smaller ratio of width or height
                const ratio = Math.min(maxSize[0] / natSize[0], maxSize[1] / natSize[1]);
                return natSize.map(size => Math.floor(size * ratio));
            }
        case ResizePolicy.STATUS_PAGE:
            return [400, 420];
        default:
            console.warn(`Renderer uses unknown resize policy '${this.resizePolicy}'`);
            return maxSize;
        }
    }

    stopRenderer() {
        const cancellable = this.getCancellable();
        cancellable.cancel();
        this.stop();
    }
}
