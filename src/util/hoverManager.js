/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors
 *
 * Authors: Nokse <nokse@posteo.com>
 * Authors: Peter Eisenmann <p3732@getgoogleoff.me>
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {SourceId} from './source.js';

export class HoverManager {
    #revealTimeoutId = new SourceId();

    constructor(toolbarView, titlebar) {
        this._lastX = 0.0;
        this._lastY = 0.0;
        this._hoveredChildren = 0;
        this._fullscreened = false;
        this._revealer = null;

        const motion = new Gtk.EventControllerMotion();
        motion.connect_object(
            'motion', (_motion, x, y) => this._onMotion(x, y),
            toolbarView, GObject.ConnectFlags.DEFAULT
        );
        toolbarView.add_controller(motion);

        this.addWidget(titlebar);

        this._toolbarView = toolbarView;
    }

    addWidget(widget) {
        if (!widget)
            return;
        const motion = new Gtk.EventControllerMotion();
        motion.connect_object(
            'enter', () => {
                this.#revealTimeoutId.remove();
                this._setRevealed(true);
                this._hoveredChildren++;
            },
            widget, GObject.ConnectFlags.DEFAULT
        );
        motion.connect_object(
            'leave', () => {
                this.#resetTimeout();
                this._hoveredChildren--;
            },
            widget, GObject.ConnectFlags.DEFAULT
        );
        widget.add_controller(motion);
    }

    setRevealer(revealer) {
        if (revealer && !(revealer instanceof Gtk.Revealer)) {
            console.error('Trying to add non-GtkRevealer as revealer!');
            return;
        }

        this._revealer = revealer;
        if (this._revealer)
            this.addWidget(this._revealer.get_child());
    }

    setFullscreened(fullscreened) {
        if (this._fullscreened === fullscreened)
            return;
        this._fullscreened = fullscreened;
        this._setRevealed(true);
    }

    _onMotion(x, y) {
        if (this._hoveredChildren !== 0)
            return;

        if (this._lastX !== x && this._lastY !== y) {
            this._setRevealed(true);
            this.#resetTimeout();
            this._lastX = x;
            this._lastY = y;
        }
    }

    _setRevealed(revealed) {
        if (this._revealer)
            this._revealer.set_reveal_child(revealed);
        if (this._toolbarView) {
            this._toolbarView.set_reveal_top_bars(revealed || !this._fullscreened);
            this._toolbarView.set_reveal_bottom_bars(revealed || !this._fullscreened);
        }
    }

    #resetTimeout() {
        this.#revealTimeoutId.timeoutAddOnce(
            GLib.PRIORITY_DEFAULT,
            1500,
            () => this._setRevealed(false));
    }
}
