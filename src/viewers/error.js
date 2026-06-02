
/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

const {Adw, GLib, GObject, Gtk} = imports.gi;

const Renderer = imports.ui.renderer;

const Klass = GObject.registerClass({
    Implements: [Renderer.Renderer],
    Properties: {
        fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                              GObject.ParamFlags.READABLE,
                                              false),
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false)
    },
}, class ErrorRenderer extends Adw.Bin {
    _init(error) {
        super._init();

        this._status_page = new Adw.StatusPage({ css_classes: ['compact'] });

        this._status_page.set_title(_("Preview Failed"));
        this._status_page.set_description(error.message);
        this._status_page.set_icon_name('image-missing-symbolic');

        this.set_child(this._status_page);
    }

    get resizable() {
        return false;
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.FLAT;
    }
});

var ErrorRenderer = Klass;
