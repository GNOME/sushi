/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {isCancelledError} from '../util/error.js';

/** Note: This constant is part of the stable plugin API. Only change it in backwards-compatible ways. */
export const ResizePolicy = Object.freeze({
    MAX_SIZE: 0,
    NAT_SIZE: 1,
    SCALED: 2,
    STATUS_PAGE: 3,
});

/** Note: This is part of the stable plugin API. Only change it in backwards-compatible ways. */
export const resolveRelativePath = (url, filename) => GLib.Uri.resolve_relative(
    url, filename, GLib.UriFlags.NONE
);

// We can't use private elements for the `Renderer` because it's not really a parent
// class of the implementors. gjs only copies over the properties and functions.

/** @type {WeakMap<any, boolean>}
 * Tri-state: true -> ready, false -> stopped/failed, no entry -> not ready */
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
                'failed': {param_types: [GLib.Error.$gtype]},
                'ready': {param_types: []},
            },
        }, this);
    }

    /* Methods called by subclasses */

    /** @returns {Gio.Cancellable} */
    get cancellable() {
        return getCancellable(this);
    }

    markFailed(error) {
        if (ready.get(this) === false) {
            // Prevent overwriting of previous error, but log error still
            if (!isCancelledError(error))
                console.error(`Failed renderer failed again with "${error?.message ?? '[Unknown]'}"`);
            return;
        }
        stopRenderer(this);
        this.emit('failed', error);
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
        if (this.cancellable.is_cancelled() || ready.get(this) !== undefined)
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
 *  @returns {boolean} */
export const isRendererReady = renderer => {
    return !!ready.get(renderer);
};

/** @param {Renderer|null|undefined} renderer */
export const stopRenderer = renderer => {
    if (!renderer || ready.get(renderer) === false)
        return;
    ready.set(renderer, false);
    getCancellable(renderer).cancel();
    renderer.stop();
};

/** @param {Renderer} renderer
 *  @returns {Gio.Cancellable} */
const getCancellable = renderer =>
    getOrInsertComputed(cancellable, renderer, () => new Gio.Cancellable());
