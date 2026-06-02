
/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

const {Adw, Gdk, GLib, GObject, Gtk, Pango} = imports.gi;

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

        this._error_msg = error.message;
        const index = this._error_msg.indexOf('\n')
        const first_line = this._error_msg.substring(0, index)
        const long_error = (this._error_msg[index + 1] != undefined)

        this._status_page = new Adw.StatusPage({ css_classes: ['compact'] });

        this._status_page.set_title(_("Preview Failed"));
        this._status_page.set_icon_name('image-missing-symbolic');
        this._status_page.set_description(first_line + (this._error_msg ? "…" : ""));

        var copy_error_button = new Gtk.Button({ label: _("Copy Full Error Message"),
                                                  halign: Gtk.Align.CENTER,
                                                  css_classes: ["pill"] })
        copy_error_button.connect('clicked', () => {
            const clipboard = Gdk.Display.get_default()?.get_clipboard();
            clipboard?.set(this._error_msg);
        });

        this._status_page.set_child(copy_error_button);
        this.set_child(this._status_page);
    }

    get resizable() {
        return false;
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.FLAT;
    }

    get resizePolicy() {
        return ResizePolicy.NAT_SIZE;
    }
});

var ErrorRenderer = Klass;
