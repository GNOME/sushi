/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors
 *
 * Authors: Nokse <nokse@posteo.com>
 */

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

export class ToolbarOverlay extends Adw.Bin {
    static {
        GObject.registerClass({
            Implements: [Gtk.Buildable],
            Properties: {
                child: GObject.ParamSpec.object(
                    'child',
                    null,
                    null,
                    GObject.ParamFlags.READWRITE,
                    Gtk.Widget
                ),
            },
        }, this);
    }

    constructor(constructProperties = {}) {
        super(constructProperties);

        this._overlay = new Gtk.Overlay();
        this.bind_property(
            'child',
            this._overlay,
            'child',
            GObject.BindingFlags.SYNC_CREATE);
        this.set_child(this._overlay);

        this._revealerOverlays = [];
        if (this._initialOverlays) {
            for (const overlay of this._initialOverlays)
                this.add_overlay(overlay);
        }
        this._initialOverlays = null;

        this._lastX = 0.0;
        this._lastY = 0.0;
        this._revealTimeoutId = 0;
        this._hoveredChildren = 0;

        this._motion = new Gtk.EventControllerMotion();
        this._motion.connect_object(
            'motion', (_motion, x, y) => this._onMotion(x, y),
            this, GObject.ConnectFlags.DEFAULT
        );
        this.add_controller(this._motion);
    }

    vfunc_add_child(builder, child, type) {
        if (child instanceof Gtk.Widget && type === 'overlay')
            this._initialOverlays = [...this._initialOverlays ?? [], child];
        else
            super.vfunc_add_child(builder, child, type);
    }

    add_overlay(widget) {
        const _motion = new Gtk.EventControllerMotion();
        _motion.connect_object(
            'enter', () => {
                this._removeRevealTimeout();
                this._revealAll(true);
                this._hoveredChildren++;
            },
            this, GObject.ConnectFlags.DEFAULT
        );
        _motion.connect_object(
            'leave', () => {
                this._resetTimeout();
                this._hoveredChildren--;
            },
            this, GObject.ConnectFlags.DEFAULT);
        widget.add_controller(_motion);

        if (widget instanceof Gtk.Revealer)
            this._revealerOverlays.push(widget);

        this._overlay.add_overlay(widget);
    }

    cleanupOverlay() {
        for (const revealer of this._revealerOverlays)
            this._overlay.remove_overlay(revealer);
        this._revealerOverlays = [];
        this._overlay = null;
        this.set_child(null);
    }

    _onMotion(x, y) {
        if (this._hoveredChildren !== 0)
            return;

        if (this._lastX !== x && this._lastY !== y) {
            this._revealAll(true);
            this._resetTimeout();
            this._lastX = x;
            this._lastY = y;
        }
    }

    _revealAll(revealed) {
        for (const revealer of this._revealerOverlays)
            revealer.set_reveal_child(revealed);
    }

    _resetTimeout() {
        this._removeRevealTimeout();
        this._revealTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT, 1500, this._onRevealTimeout.bind(this));
    }

    _onRevealTimeout() {
        this._revealTimeoutId = 0;
        this._revealAll(false);
        return GLib.SOURCE_REMOVE;
    }

    _removeRevealTimeout() {
        if (this._revealTimeoutId !== 0) {
            GLib.source_remove(this._revealTimeoutId);
            this._revealTimeoutId = 0;
        }
    }
}
