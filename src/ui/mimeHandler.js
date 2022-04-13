/*
 * Copyright (C) 2011 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 *
 * The Sushi project hereby grant permission for non-gpl compatible GStreamer
 * plugins to be used and distributed together with GStreamer and Sushi. This
 * permission is above and beyond the permissions granted by the GPL license
 * Sushi is covered by.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

const {Gio, GLib} = imports.gi;

const FallbackRenderer = imports.ui.fallbackRenderer;

var renderers = [];

//Patch import path
let localPath = GLib.build_filenamev([GLib.get_user_data_dir(), 'sushi']);
imports.searchPath.push(localPath);

for (let i in imports.viewers) {
    if (imports.viewers[i].hasOwnProperty('mimeTypes')) {
        renderers.push(imports.viewers[i]);
    }
}

var getKlass = function(mime) {
    let renderer = renderers.find((r) => {
        // first, try a direct match with the mimetype itself
        if (r.mimeTypes.includes(mime))
            return true;
        return false;
    });

    if (!renderer) {
        renderer = renderers.find((r) => {
            // if this fails, try to see if we have any handlers
            // registered for a parent type
            if (r.mimeTypes.some((rm) => Gio.content_type_is_a(mime, rm)))
                return true;
            return false;
        });
    }

    if (renderer)
        return renderer.Klass;

    // finally, resort to the fallback renderer
    return FallbackRenderer.FallbackRenderer;
}
