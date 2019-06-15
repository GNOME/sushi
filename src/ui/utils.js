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

const {Gtk} = imports.gi;

function getScaledSize(baseSize, allocSize, upscale) {
    let allocW = allocSize[0];
    let allocH = allocSize[1];
    let width = baseSize[0];
    let height = baseSize[1];
    let scale = 1.0;

    if (((width <= allocW && height <= allocH) && upscale) ||
        (width > allocW && height > allocH)) {
        /* up/downscale both directions */
        let allocRatio = allocW / allocH;
        let baseRatio = width / height;

        if (baseRatio > allocRatio)
            scale = allocW / width;
        else
            scale = allocH / height;
    } else if (width > allocW &&
               height <= allocH) {
        /* downscale x */
        scale = allocW / width;
    } else if (width <= allocW &&
               height > allocH) {
        /* downscale y */
        scale = allocH / height;
    }

    width *= scale;
    height *= scale;

    return [ Math.floor(width), Math.floor(height) ];
}

function createToolButton(iconName, callback) {
    let button = Gtk.Button.new_from_icon_name(iconName, Gtk.IconSize.MENU);
    button.set_relief(Gtk.ReliefStyle.NONE);
    button.connect('clicked', callback);

    return button;
}

function createFullscreenButton(renderer) {
    return createToolButton('view-fullscreen-symbolic', function(button) {
        renderer.toggleFullscreen();
        if (renderer.fullscreen)
            button.icon_name = 'view-restore-symbolic';
        else
            button.icon_name = 'view-fullscreen-symbolic';
    });
}

function createOpenButton(file, mainWindow) {
    return createToolButton('document-open-symbolic', function(widget) {
        let timestamp = Gtk.get_current_event_time();
        try {
            Gtk.show_uri(widget.get_screen(),
                         file.get_uri(),
                         timestamp);

            mainWindow.destroy();
        } catch (e) {
            log('Unable to execute the default application for ' +
                file.get_uri() + ' : ' + e.toString());
        }
    });
}