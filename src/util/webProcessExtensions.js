// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import GLib from 'gi://GLib';

import {WEB_PROCESS_EXTENSIONS_DIRECTORY} from '../config.js';
import {isRunningFromMesonSource, getMesonBuildRoot} from './development.js';

/** @param {WebKit.WebContext} context */
export const registerWebProcessExtension = context => {
    const directory = isRunningFromMesonSource()
        ? GLib.build_filenamev([getMesonBuildRoot(), 'src', 'web-process-extension'])
        : WEB_PROCESS_EXTENSIONS_DIRECTORY;
    context.add_path_to_sandbox(directory, /* read_only */ true);
    context.connect(
        'initialize-web-process-extensions',
        () => context.set_web_process_extensions_directory(directory));
};
