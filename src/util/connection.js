// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

/** A wrapper around a GObject signal connection that simplifies disconnect/cleanup. */
export class Connection {
    #id = 0;
    #object = null;
    #signal;
    #function;

    /** Define the signal and callback the connection should manage
     *  @param {string} signal to connect with
     *  @param {() => void} fn function to call when the signal is emitted */
    constructor(signal, fn) {
        this.#signal = signal;
        this.#function = fn;
    }

    /** @param {GObject.GObject} object to create a connection to */
    connect(object) {
        if (this.#id !== 0)
            this.disconnect();

        this.#id = object.connect(this.#signal, this.#function);
        this.#object = new WeakRef(object);
    }

    disconnect() {
        if (this.#id !== 0) {
            this.#object?.deref()?.disconnect(this.#id);
            this.#id = 0;
        }
        this.#object = null;
    }
}
