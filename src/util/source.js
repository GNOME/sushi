// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import GLib from 'gi://GLib';

/** A wrapper around a GLib source ID that simplifies removing/replacing the source. */
export class SourceId {
    #id = 0;

    /** @return {boolean} */
    get added() {
        return this.#id !== 0;
    }

    /** Replaces the current source with one created using `GLib.timeout_add`.
     *  The source is thus removed after one invocation.
     *  @param {number} priority
     *  @param {number} interval
     *  @param {() => void} fn
     *  @param {boolean} repeated */
    addTimeout(priority, interval, fn, repeated = false) {
        const wrapper = () => {
            fn();
            if (!repeated) {
                this.#id = 0;
                return GLib.SOURCE_REMOVE;
            } else {
                return GLib.SOURCE_CONTINUE;
            }
        };
        this.#replace(GLib.timeout_add(priority, interval, wrapper));
    }

    /** Adds a timeout if one is not already set. See `addTimeout`.
     *  @param {number} priority
     *  @param {number} interval
     *  @param {() => void} callback
     *  @param {boolean} repeated */
    ensureTimeout(priority, interval, callback, repeated = false) {
        if (this.#id === 0)
            this.addTimeout(priority, interval, callback, repeated);
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
