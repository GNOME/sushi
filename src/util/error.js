// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

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
