// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

/** A wrapper around a GObject signal connection that simplifies disconnect/cleanup. */
export class Connection {
    #id = 0;
    #object = null;

    /** @param {GObject.GObject} object to create a connection to
     *  @param {string} signal to connect with
     *  @param {() => boolean} fn function to call when the signal is emitted */
    connect(object, signal, fn) {
        if (this.#id !== 0)
            this.disconnect();

        this.#id = object.connect(signal, fn);
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
