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
    // Renderers need to provide a contentTypes list or a supportsContentType function (or both)
    return renderers.filter(r => Object.hasOwn(r, 'contentTypes') || Object.hasOwn(r, 'supportsContentType'));
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

const toRendererEntry = renderer => {
    const supportsFile = typeof renderer.supportsFile === 'function' ? renderer.supportsFile : () => true;
    return {Klass: renderer.Klass, supportsFile};
};

const [contentTypeMap, contentTypeFunctions] = await (async () => {
    const renderers = await loadRenderers();
    const contentTypeMap = Object.fromEntries(renderers.flatMap(
        r => Array.isArray(r.contentTypes) ? r.contentTypes.map(type => [type, toRendererEntry(r)]) : []
    ));
    const contentTypeFunctions = renderers.map(
        r => r.supportsContentType instanceof Function ? [r.supportsContentType, toRendererEntry(r)] : null
    ).filter(Boolean);

    return [Object.freeze(contentTypeMap), contentTypeFunctions];
})();

/** @param {string} contentType
 *  @param {Gio.File} file */
export const selectRenderer = (contentType, file) => {
    const directMatch = contentTypeMap[contentType];
    if (directMatch && directMatch.supportsFile(file))
        return directMatch.Klass;

    const checkType = ([supportedType, renderer]) => Gio.content_type_is_a(contentType, supportedType) && renderer.supportsFile(file);
    const entry = Object.entries(contentTypeMap).find(checkType) ??
        contentTypeFunctions.find(([fn, renderer]) => fn(contentType) && renderer.supportsFile(file));
    const renderer = entry?.[1]?.Klass ?? FallbackRenderer;

    return renderer;
};
