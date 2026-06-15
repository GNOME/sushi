/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors
 *
 * Authors: Nokse <nokse@posteo.com>
 */

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

export class ToolbarOverlay extends Gtk.Overlay {
    static {
        GObject.registerClass(this);
    }

    constructor(constructProperties = {}) {
        super(constructProperties = {});

        this._lastX = 0.0;
        this._lastY = 0.0;
        this._revealTimeoutId = 0;
        this._hoveredChildren = 0;

        this._motion = new Gtk.EventControllerMotion();
        this._motion.connect('motion', this._onMotion.bind(this));
        this.add_controller(this._motion);
    }

    add_overlay(widget) {
        const _motion = new Gtk.EventControllerMotion();
        _motion.connect('enter', () => {
            this._removeRevealTimeout();
            this._revealAll();
            this._hoveredChildren++;
        });
        _motion.connect('leave', () => {
            this._resetTimeout();
            this._hoveredChildren--;
        });
        widget.add_controller(_motion);

        super.add_overlay(widget);
    }

    _onMotion(_motion, x, y) {
        if (this._hoveredChildren !== 0)
            return;

        if (this._lastX !== x && this._lastY !== y) {
            this._revealAll();
            this._resetTimeout();
            this._lastX = x;
            this._lastY = y;
        }
    }

    _revealAll() {
        for (const child of this._getRevealers())
            child.set_reveal_child(true);
    }

    _hideAll() {
        for (const child of this._getRevealers())
            child.set_reveal_child(false);
    }

    _getRevealers() {
        const revealers = [];
        let child = this.get_first_child();
        while (child) {
            if (child instanceof Gtk.Revealer)
                revealers.push(child);
            child = child.get_next_sibling();
        }
        return revealers;
    }

    _resetTimeout() {
        this._removeRevealTimeout();
        this._revealTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT, 1500, this._onRevealTimeout.bind(this));
    }

    _onRevealTimeout() {
        this._revealTimeoutId = 0;
        this._hideAll();
        return GLib.SOURCE_REMOVE;
    }

    _removeRevealTimeout() {
        if (this._revealTimeoutId !== 0) {
            GLib.source_remove(this._revealTimeoutId);
            this._revealTimeoutId = 0;
        }
    }
}
