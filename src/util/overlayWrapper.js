/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi developers
 *
 * Authors: Peter Eisenmann <p3732@getgoogleoff.me>
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

export class OverlayWrapper extends Gtk.Overlay {
    static {
        GObject.registerClass({
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/overlayWrapper.ui',
            InternalChildren: ['revealer'],
        }, this);
    }

    constructor(renderer, overlay) {
        super({child: renderer});

        this._revealer.set_child(overlay);
    }
}
