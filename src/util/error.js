// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

/** @param {any} error
 *  @returns {boolean} */
export const isCancelledError = error =>
    isGLibError(error, Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED);

/** @param {any} error
 *  @param {GLib.Quark} domain
 *  @param {number} code
 *  @returns {boolean} */
export const isGLibError = (error, domain, code) =>
    error instanceof GLib.Error &&
    error.matches(domain, code);

/** A Swiss army knife error wrapper that extracts messages from different
 *  error types, such as GLib.Error. */
export class WrappedError extends GObject.Object {
    static {
        GObject.registerClass(this);
    }

    #message;
    #summary;

    /** @param {any} error that occured */
    constructor(error, constructProperties = {}) {
        super(constructProperties);

        this.#message = this.#extractMessage(error);
        this.#summary = this.#extractSummary(error);
    }

    #extractMessage(error) {
        if (isGLibError(error))
            return error.message.trim();
        else
            return `${error}`;
    }

    #extractSummary(error) {
        const lines = this.#message.split('\n');

        if (isGLibError(error) &&
            lines.length > 1 &&
            GLib.quark_to_string(error.domain) === 'gst-play-error-quark' &&
            error.code === 1)
            return lines[1];
        else
            return null;
    }

    get message() {
        return this.#message;
    }

    get summary() {
        return this.#summary;
    }
}
