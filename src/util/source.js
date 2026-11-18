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
        const wrapper = () => {
            fn();
            this.#id = 0;
            return GLib.SOURCE_REMOVE;
        };
        this.#replace(GLib.timeout_add(this.#priority, interval, wrapper));
    }

    /** Adds a timeout if one is not already set. See `addTimeout`.
     *  @param {number} interval
     *  @param {() => void} fn */
    ensureTimeout(interval, fn) {
        if (this.#id === 0)
            this.addTimeout(interval, fn);
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
}
