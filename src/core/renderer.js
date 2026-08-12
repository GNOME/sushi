/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

/** Note: This constant is part of the stable plugin API. Only change it in backwards-compatible ways. */
export const ResizePolicy = Object.freeze({
    MAX_SIZE: 0,
    NAT_SIZE: 1,
    SCALED: 2,
    STATUS_PAGE: 3,
    CUSTOM: 4,
});

/** Note: This is part of the stable plugin API. Only change it in backwards-compatible ways. */
export const resolveRelativePath = (url, filename) => GLib.Uri.resolve_relative(
    url, filename, GLib.UriFlags.NONE
);

// We can't use private elements for the `Renderer` because it's not really a parent
// class of the implementors. gjs only copies over the properties and functions.

/** @type {WeakMap<any, boolean>} */
const ready = new WeakMap();
/** @type {WeakMap<any, Gio.Cancellable>} */
const cancellable = new WeakMap();
/** @type {WeakMap<any, number>} */
const rendererUnmapId = new WeakMap();
/** @type {WeakMap} */
const toolbar = new WeakMap();

/** @template TKey
 *  @template TValue
 *  @param {WeakMap<TKey, TValue>} map
 *  @param {TKey} key
 *  @param {(key: TKey) => TValue} callback
 *  @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap/getOrInsertComputed} */
const getOrInsertComputed = (map, key, callback) => {
    if (map.has(key))
        return map.get(key);
    const value = callback(key);
    map.set(key, value);
    return value;
};

/** Note: This class is part of the stable plugin API. Only change it in backwards-compatible ways. */
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

    /** @returns {Gio.Cancellable} */
    get cancellable() {
        return getCancellable(this);
    }

    markInitialized() {
        if (rendererUnmapId.has(this))
            return;
        const cancellable = this.cancellable;
        rendererUnmapId.set(this, this.connect('unmap', () => {
            this.disconnect(rendererUnmapId.get(this));
            rendererUnmapId.set(this, 0);

            if (!cancellable.is_cancelled())
                stopRenderer(this);
            this.cleanup();
        }));
    }

    markReady() {
        if (this.cancellable.is_cancelled() || ready.get(this))
            return;
        this.markInitialized();
        ready.set(this, true);
        // Cache toolbar, renderer isn't meant to dynamically change this
        toolbar.set(this, this.toolbar);
        this.emit('ready');
    }

    /* Virtual methods, overridable by subclasses */

    stop() {
        // override this function with code to stop e.g. running animations
    }

    cleanup() {
        // override this function with cleanup code
    }

    /** @returns {ResizePolicy[keyof ResizePolicy]} */
    get resizePolicy() {
        return ResizePolicy.MAX_SIZE;
    }

    /** @returns {[number, number] | null} */
    get customSize() {
        // customSize needs to be overridden for ResizePolicy.CUSTOM
        return null;
    }

    get toolbar() {
        return null;
    }

    /** @returns {Adw.ToolbarStyle} */
    get topBarStyle() {
        return Adw.ToolbarStyle.FLAT;
    }
}

// Functions intended to be called by main window

/** @param {Renderer} renderer */
export const getRendererToolbar = renderer => {
    return toolbar.get(renderer);
};

/** @param {Renderer} renderer
 *  @param {[number, number]} maxSize
 *  @returns {[number, number]} */
export const getRendererSize = (renderer, maxSize) => {
    const rendererSize = renderer.get_preferred_size();
    const natSize = [rendererSize[1].width, rendererSize[1].height];

    switch (renderer.resizePolicy) {
    case ResizePolicy.CUSTOM: {
        const customSize = renderer.customSize;
        if (!customSize) {
            console.error('ResizePolicy programming error');
            return [1, 1];
        } else if (customSize[0] <= maxSize[0] && customSize[1] <= maxSize[1]) {
            // no scaling needed
            return customSize;
        } else {
            // scale by smaller ratio of width or height
            const ratio = Math.min(maxSize[0] / customSize[0], maxSize[1] / customSize[1]);
            return customSize.map(size => Math.floor(size * ratio));
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
        console.warn(`Renderer uses unknown resize policy '${renderer.resizePolicy}'`);
        return maxSize;
    }
};

/** @param {Renderer} renderer
 *  @returns {boolean} */
export const isRendererReady = renderer => {
    return !!ready.get(renderer);
};

/** @param {Renderer|null|undefined} renderer */
export const stopRenderer = renderer => {
    if (!renderer)
        return;
    getCancellable(renderer).cancel();
    renderer.stop();
};

/** @param {Renderer} renderer
 *  @returns {boolean} */
export const isRendererStopped = renderer =>
    getCancellable(renderer).is_cancelled();

/** @param {Renderer} renderer
 *  @returns {Gio.Cancellable} */
const getCancellable = renderer =>
    getOrInsertComputed(cancellable, renderer, () => new Gio.Cancellable());
