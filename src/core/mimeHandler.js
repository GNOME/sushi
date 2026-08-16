/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {resolveRelativePath} from './renderer.js';
import {isGLibError} from '../util/error.js';
import {FallbackRenderer} from '../viewers/fallback.js';
import {SYSTEM_PLUGIN_DIRECTORY} from '../config.js';

/** @returns {string[]} uri sources */
const getRendererURIs = () => {
    const localPath = GLib.build_filenamev([GLib.get_user_data_dir(), 'sushi', 'plugins-1']);
    const builtInPath = resolveRelativePath(import.meta.url, '../viewers');

    // Load plugins in order: built-in, system directory, user directory.
    // This way a user can overwrite built-in content types.
    return [
        builtInPath,
        GLib.filename_to_uri(SYSTEM_PLUGIN_DIRECTORY, null),
        GLib.filename_to_uri(localPath, null),
    ];
};

const loadRenderers = async () => {
    const renderers = await Promise.all(
        getRendererURIs()
            .flatMap(enumerateRenderers)
            .map(loadRendererModule)
    );
    return renderers.filter(renderer => Object.hasOwn(renderer, 'mimeTypes'));
};

/** @param {string} uri
 *  @returns {string[]} renderer URIs */
const enumerateRenderers = uri => {
    try {
        const parent = Gio.File.new_for_uri(uri);
        const flags = Gio.FileQueryInfoFlags.NONE;
        const enumerator = parent.enumerate_children('standard::*', flags, null);
        return [...enumerator]
            .filter(info => info.get_name().endsWith('.js'))
            .map(info => enumerator.get_child(info).get_uri());
    } catch (error) {
        if (isGLibError(error, Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            return [];
        else
            throw error;
    }
};

/** @param {string} uri
 *  @param {string} fileName */
const loadRendererModule = async uri => {
    try {
        return await import(uri);
    } catch (error) {
        console.error(`failed to load renderer '${uri}': ${error}`);
        return [];
    }
};

const contentTypeMap = await (async () => {
    const renderers = await loadRenderers();
    return Object.fromEntries(renderers.flatMap(
        r => r.mimeTypes.map(type => [type, r.Klass])
    ));
})();

/** @param {string} mime */
export const getKlass = mime => {
    const directMatch = contentTypeMap[mime];
    if (directMatch)
        return directMatch;

    const checkType = ([contentType, _]) => Gio.content_type_is_a(mime, contentType);
    const entry = Object.entries(contentTypeMap).find(checkType);
    const renderer = entry?.[1] ?? FallbackRenderer;

    contentTypeMap[mime] = renderer;

    return renderer;
};
