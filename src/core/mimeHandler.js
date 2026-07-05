/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {FallbackRenderer} from '../viewers/fallback.js';

/** @param {Gio.File[]} sources */
const loadRenderers = async (sources) => {
    const fileNames = new Set(sources.flatMap(enumerateRenderers).map(fileInfo => fileInfo.get_name()));
    const renderers = await Promise.all([...fileNames].map(fileName => loadRendererModule(fileName, sources)));
    return renderers.filter(renderer => Object.hasOwn(renderer, 'mimeTypes'));
};

/** @param {Gio.File} source
 *  @returns {Gio.FileInfo[]} */
const enumerateRenderers = (source) => {
    try {
        return [...source.enumerate_children("standard::*", Gio.FileQueryInfoFlags.NONE, null)];
    } catch (error) {
        if (error instanceof GLib.Error && error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            return [];
        else
            throw error;
    }
};

/** @param {string} fileName
 *  @param {Gio.File[]} sources */
const loadRendererModule = async (fileName, sources) => {
    const errors = [];
    for (const source of sources) {
        try {
            const uri = source.get_child(fileName).get_uri();
            // eslint-disable-next-line no-await-in-loop
            return await import(uri);
        } catch (error) {
            errors.push(error);
        }
    }
    throw new AggregateError(errors, `failed to load renderer '${fileName}':\n${errors.map(e => `* ${e}`).join('\n')}`);
};

// Patch import path
const localPath = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_data_dir(), 'sushi', 'viewers']));
const builtinPath = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent().get_child('viewers');
const renderers = await loadRenderers([localPath, builtinPath]);

/** @param {string} mime */
export const getKlass = (mime) => {
    const renderer = (
        // first, try a direct match with the mimetype itself
        renderers.find(r => r.mimeTypes.includes(mime)) ??
        // if this fails, try to see if we have any handlers
        // registered for a parent type
        renderers.find(r => r.mimeTypes.some(rm => Gio.content_type_is_a(mime, rm)))
    );
    return renderer ? renderer.Klass : FallbackRenderer;
};
