/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi developers
 *
 * Authors: Tau Gärtli <git@tau.garden>
 */

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gsk from 'gi://Gsk';
import Gtk from 'gi://Gtk';

// This file is a port of GNOME Music's CoverPaintable

const RADIUS = 9;

export class CoverPaintable extends GObject.Object {
    static {
        GObject.registerClass({
            Properties: {
                'texture': GObject.ParamSpec.object(
                    'texture',
                    'Texture',
                    null,
                    GObject.ParamFlags.READWRITE,
                    Gdk.Texture,
                ),
                'scale-factor': GObject.ParamSpec.int(
                    'scale-factor',
                    'Scale Factor',
                    'The scale factor of the paintable',
                    GObject.ParamFlags.READWRITE,
                    1, /* minimum */
                    GLib.MAXINT32, /* maximum */
                    1, /* default */
                ),
                'display': GObject.ParamSpec.object(
                    'display',
                    'Display',
                    null,
                    GObject.ParamFlags.READWRITE,
                    Gdk.Display,
                ),
            },
            Implements: [Gdk.Paintable],
        }, this);
    }

    constructor(constructProperties = {}) {
        super(constructProperties);
        if (!this._settings)
            this._setSettings(Gtk.Settings.get_default());
    }

    destroy() {
        this._settingsSignalGroup?.set_target(null);
    }

    get texture() {
        return this._texture;
    }

    set texture(texture) {
        if (texture === this._texture)
            return;

        this._texture = texture;
        this.invalidate_contents();
        this.notify('texture');
    }

    get scale_factor() {
        return this._scaleFactor;
    }

    set scale_factor(scaleFactor) {
        scaleFactor ??= 1;
        if (scaleFactor === this._scaleFactor)
            return;

        this._scaleFactor = scaleFactor;
        this.invalidate_contents();
        this.notify('scale-factor');
    }

    get display() {
        return this._display;
    }

    set display(display) {
        if (display === this._display)
            return;

        this._display = display;
        this._iconTheme = (display
            ? Gtk.IconTheme.get_for_display(display)
            : null);
        this._setSettings(display
            ? Gtk.Settings.get_for_display(display)
            : Gtk.Settings.get_default());

        if (!this._texture)
            this.invalidate_contents();

        this.notify('display');
    }

    /**
     * @param {Gdk.Snapshot} snapshot
     * @param {number} width
     * @param {number} height
     * @return void
     */
    vfunc_snapshot(snapshot, width, height) {
        if (this._texture)
            this._snapshotTexture(this._texture, snapshot, width, height);
        else if (this._iconTheme)
            this._snapshotFallbackIcon(this._iconTheme, snapshot, width, height);
    }

    _snapshotTexture(texture, snapshot, width, height) {
        const original_width = width;
        const original_height = height;
        const ratio = texture.get_height() / texture.get_width();
        // Scale down the image according to the biggest axis
        if (ratio > 1) {
            width = width / ratio;
        } else {
            height = height * ratio;
        }
        const scaleFactor = this._scaleFactor;
        const scaleFactorInverse = 1 / scaleFactor;

        snapshot.save();
        snapshot.scale(scaleFactorInverse, scaleFactorInverse);

        const rect = new Graphene.Rect()
            .init(
                (original_width - width) / 2,
                (original_height - height) / 2,
                width,
                height)
            .scale(scaleFactor, scaleFactor);
        const roundedRect = new Gsk.RoundedRect();
        roundedRect.init_from_rect(rect, RADIUS * scaleFactor);
        snapshot.push_rounded_clip(roundedRect);

        snapshot.append_scaled_texture(texture, Gsk.ScalingFilter.TRILINEAR, rect);

        snapshot.pop();
        snapshot.restore();
    }

    _snapshotFallbackIcon(iconTheme, snapshot, width, height) {
        const roundedRect = new Gsk.RoundedRect();
        roundedRect.init_from_rect(
            new Graphene.Rect().init(0, 0, width, height), RADIUS);
        snapshot.push_rounded_clip(roundedRect);

        const scaleFactor = this._scaleFactor;
        const iconScale = 1 / 3;
        const iconWidth = width * iconScale;
        const iconHeight = height * iconScale;
        const icon = iconTheme.lookup_icon(
            'audio-x-generic-symbolic', null, iconWidth, scaleFactor, 0, 0);

        const bgColor = new Gdk.RGBA();
        const bgColorString = (this._settings.gtk_interface_color_scheme == Gtk.InterfaceColorScheme.DARK
            ? "rgba(30%, 30%, 30%, 1)"
            : "rgba(95%, 95%, 95%, 1)");
        bgColor.parse(bgColorString);

        snapshot.append_color(bgColor, new Graphene.Rect().init(0, 0, width, height));
        snapshot.translate(
            new Graphene.Point().init(
                (width / 2) - (iconWidth / 2),
                (height / 2) - (iconHeight / 2)));
        snapshot.push_opacity(0.7);
        icon.snapshot(snapshot, iconWidth, iconHeight);
        snapshot.pop();

        snapshot.pop();
    }

    _onInterfaceColorSchemeChanged() {
        if (!this._texture)
            this.invalidate_contents();
    }

    _setSettings(settings) {
        this._settings = settings;
        this._settingsSignalGroup ??= this._createSettingsSignalGroup();
        this._settingsSignalGroup.set_target(settings);
    }

    _createSettingsSignalGroup() {
        const signalGroup = new GObject.SignalGroup();
        signalGroup.connect_closure(
            "notify::gtk-interface-color-scheme",
            this._onInterfaceColorSchemeChanged.bind(this),
            false);
        return signalGroup;
    }
}
