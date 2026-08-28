/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi developers
 *
 * Authors: Peter Eisenmann <p3732@getgoogleoff.me>
 */

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

export class RendererWrapper extends Adw.Bin {
    static {
        GObject.registerClass({
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/rendererWrapper.ui',
            InternalChildren: ['revealer', 'overlay'],
        }, this);
    }

    constructor(renderer, overlay, hoverManager) {
        super();

        this._overlay.set_child(renderer);
        this._revealer.set_child(overlay);

        hoverManager.setRevealer(this._revealer);
    }
}
