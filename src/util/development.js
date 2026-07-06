// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import GLib from 'gi://GLib';

/** @returns {boolean} */
export const isRunningFromMesonSource = () =>
    Boolean(GLib.getenv('MESON_BUILD_ROOT') &&
            GLib.getenv('MESON_SOURCE_ROOT'));

/** @returns {string} */
export const getMesonBuildRoot = () =>
    GLib.getenv('MESON_BUILD_ROOT');
