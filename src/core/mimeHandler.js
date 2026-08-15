/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {resolveRelativePath} from './renderer.js';
import {FallbackRenderer} from '../viewers/fallback.js';
import {SYSTEM_PLUGIN_DIRECTORY} from '../config.js';

/** @returns {string[]} uri sources */
const getRendererURIs = () => {
    const localPath = GLib.build_filenamev([GLib.get_user_data_dir(), 'sushi', 'plugins-1']);
    const builtInPath = resolveRelativePath(import.meta.url, '../viewers');

    // Load plugins in order user directory, system directory, and built-in.
    // This way users can overwrite built-in mime types.
    return [
        GLib.filename_to_uri(localPath, null),
        GLib.filename_to_uri(SYSTEM_PLUGIN_DIRECTORY, null),
        builtInPath,
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
        if (error instanceof GLib.Error && error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
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

const renderers = await loadRenderers();

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
