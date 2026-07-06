/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {FallbackRenderer} from '../viewers/fallback.js';
import {SYSTEM_PLUGIN_DIRECTORY} from '../config.js';

/** @param {Gio.File[]} sources */
const loadRenderers = async sources => {
    const renderers = await Promise.all(
        sources
            .flatMap(enumerateRenderers)
            .map(nameAndSource => loadRendererModule(...nameAndSource))
    );
    return renderers.filter(renderer => Object.hasOwn(renderer, 'mimeTypes'));
};

/** @param {Gio.File} source
 *  @returns {Gio.FileInfo[]} */
const enumerateRenderers = source => {
    try {
        return [...source.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null)]
            .map(fileInfo => [fileInfo.get_name(), source]);
    } catch (error) {
        if (error instanceof GLib.Error && error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            return [];
        else
            throw error;
    }
};

/** @param {string} fileName
 *  @param {Gio.File[]} sources */
const loadRendererModule = async (fileName, source) => {
    try {
        const uri = source.get_child(fileName).get_uri();
        return await import(uri);
    } catch (error) {
        console.error(`failed to load renderer '${fileName}': ${error}`);
        return [];
    }
};

// Patch import path
const localPath = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_data_dir(), 'sushi', 'plugins-1']));
const systemPath = Gio.File.new_for_path(SYSTEM_PLUGIN_DIRECTORY);
const builtinPath = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent().get_child('viewers');
const renderers = await loadRenderers([localPath, systemPath, builtinPath]);

/** @param {string} mime */
export const getKlass = mime => {
    const renderer =
        // first, try a direct match with the mimetype itself
        renderers.find(r => r.mimeTypes.includes(mime)) ??
        // if this fails, try to see if we have any handlers
        // registered for a parent type
        renderers.find(r => r.mimeTypes.some(rm => Gio.content_type_is_a(mime, rm)));
    return renderer ? renderer.Klass : FallbackRenderer;
};
