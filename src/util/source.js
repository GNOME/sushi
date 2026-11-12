// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import GLib from 'gi://GLib';

/** A wrapper around a GLib source ID that simplifies removing/replacing the source. */
export class SourceId {
    #id = 0;
    #priority;

    constructor(priority = GLib.PRIORITY_DEFAULT) {
        this.#priority = priority;
    }

    /** @return {boolean} */
    get added() {
        return this.#id !== 0;
    }

    /** Replaces the current source with one created using `GLib.timeout_add`.
     *  The source is removed after one invocation.
     *  @param {number} interval
     *  @param {() => void} fn */
    addTimeout(interval, fn) {
        this.#internalAddTimeout(false, interval, fn);
    }

    /** Equivalent to `addTimeout` but the callback will be repeated.
     *  @param {number} interval
     *  @param {() => void} fn */
    addRepeatedTimeout(interval, fn) {
        this.#internalAddTimeout(true, interval, fn);
    }

    /** Adds a timeout if one is not already set. See `addTimeout`.
     *  @param {number} interval
     *  @param {() => void} fn */
    ensureTimeout(interval, fn) {
        if (this.#id === 0)
            this.#internalAddTimeout(false, interval, fn);
    }

    /** Equivalent to `ensureTimeout` but the callback will be repeated.
     *  @param {number} interval
     *  @param {() => void} callback */
    ensureRepeatedTimeout(interval, callback) {
        if (this.#id === 0)
            this.#internalAddTimeout(true, interval, callback);
    }

    /** @param {number} id */
    #replace(id) {
        this.remove();
        this.#id = id;
    }

    remove() {
        if (this.#id !== 0) {
            GLib.source_remove(this.#id);
            this.#id = 0;
        }
    }

    #internalAddTimeout(repeated, interval, fn) {
        const wrapper = () => {
            fn();
            if (!repeated) {
                this.#id = 0;
                return GLib.SOURCE_REMOVE;
            } else {
                return GLib.SOURCE_CONTINUE;
            }
        };
        this.#replace(GLib.timeout_add(this.#priority, interval, wrapper));
    }
}
