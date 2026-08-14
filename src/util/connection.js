// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import GLib from 'gi://GLib';

/** A wrapper around a GObject signal connection that simplifies disconnect/cleanup. */
export class Connection {
    #id = 0;
    #object = null;

    /** TODO
     *  @param {GObject.GObject} object
     *  @param {string} signal to connect with
     *  @param {() => boolean} fn */
    connect(object, signal, fn) {
        this.#id = object.connect(
            signal, fn
        );
        this.#object = object;
    }

    disconnect() {
        if (this.#id !== 0) {
            this.#object?.disconnect(this.#id);
            this.#id = 0;
        }
        this.#object = null;
    }
}
