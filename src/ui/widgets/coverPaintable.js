/*
 * Copyright (C) 2026 The Sushi developers
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
 * Authors: Tau Gärtli <git@tau.garden>
 *
 */

const {Adw, GLib, GObject, Gdk, Graphene, Gsk, Gtk} = imports.gi;

// This file is a port of GNOME Music's CoverPaintable

const RADIUS = 9;

var CoverPaintable = GObject.registerClass({
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
}, class CoverPaintable extends GObject.Object {
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
            'media-optical-symbolic', null, iconWidth, scaleFactor, 0, 0);

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
});
