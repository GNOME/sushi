// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import GLib from 'gi://GLib';

import * as System from 'system';

/** @returns {boolean} */
export const isRunningFromMesonSource = () =>
    Boolean(GLib.getenv('MESON_BUILD_ROOT') &&
            GLib.getenv('MESON_SOURCE_ROOT'));

/** @returns {string} */
export const getMesonBuildRoot = () =>
    GLib.getenv('MESON_BUILD_ROOT');

let dumpCounter = 0;
const dumpDir = GLib.build_filenamev([GLib.get_tmp_dir(), 'sushi-dumps']);

const createDump = () => {
    console.debug(`Creating dump #${dumpCounter}`);
    // Run GC to make sure no dangling objects get dumped
    System.gc();
    System.dumpHeap(GLib.build_filenamev([dumpDir, `sushi${dumpCounter}.heap`]));
    dumpCounter += 1;
    return GLib.SOURCE_CONTINUE;
};

/** Initializes periodic heap dumps if SUSHI_DUMP_INTERVAL_S is set. */
export const checkInitDumping = () => {
    const intervalSeconds = GLib.getenv('SUSHI_DUMP_INTERVAL_S');
    if (intervalSeconds) {
        console.warn(`Heap dumps will be created every ${intervalSeconds} seconds in ${dumpDir} (SUSHI_DUMP_INTERVAL_S is set)`);
        GLib.mkdir_with_parents(dumpDir, 0o755);
        GLib.timeout_add(
            GLib.G_PRIORITY_DEFAULT,
            intervalSeconds * 1000,
            createDump
        );
    }
};
