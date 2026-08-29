/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi developers
 *
 * Authors: Peter Eisenmann <p3732@getgoogleoff.me>
 */

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

import {getRendererToolbar} from '../core/renderer.js';

export class RendererWrapper extends Adw.Bin {
    static {
        GObject.registerClass({
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/rendererWrapper.ui',
            InternalChildren: ['revealer', 'overlay'],
        }, this);
    }

    /** @param {import('../core/renderer').Renderer} renderer
     *  @param {import('../util/hoverManager.js').HoverManager} hoverManager  */
    constructor(renderer, hoverManager) {
        super();

        const toolbar = getRendererToolbar(renderer);
        if (toolbar) {
            this._overlay.set_child(renderer);
            this._revealer.set_child(toolbar);
            this.set_child(this._overlay);
            hoverManager.setRevealer(this._revealer);
        } else {
            this.set_child(renderer);
            hoverManager.setRevealer(null);
        }
    }
}
