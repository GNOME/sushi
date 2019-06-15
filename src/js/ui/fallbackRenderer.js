/*
 * Copyright (C) 2011 Red Hat, Inc.
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
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;
const Sushi = imports.gi.Sushi;

const Gettext = imports.gettext.domain('sushi');
const _ = Gettext.gettext;
const Lang = imports.lang;
const Renderer = imports.ui.renderer;

var FallbackRenderer = new Lang.Class({
    Name: 'FallbackRenderer',
    Extends: Gtk.Box,

    _init : function(file, mainWindow) {
        this.parent({ orientation: Gtk.Orientation.HORIZONTAL,
                      spacing: 6 });

        this.moveOnClick = true;
        this.canFullScreen = false;

        this._fileLoader = new Sushi.FileLoader();
        this._fileLoader.file = file;
        this._fileLoaderId = this._fileLoader.connect('notify', this._onFileInfoChanged.bind(this));

        this._image = new Gtk.Image();
        this.pack_start(this._image, false, false, 0);
        this._updateIcon(new Gio.ThemedIcon({ name: 'text-x-generic' }));

        let vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                 spacing: 1,
                                 margin_top: 48,
                                 margin_start: 12,
                                 margin_end: 12 });
        this.pack_start(vbox, false, false, 0);

        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                 spacing: 6 });
        vbox.pack_start(hbox, false, false, 0);

        this._titleLabel = new Gtk.Label({ max_width_chars: 48,
                                           ellipsize: Pango.EllipsizeMode.MIDDLE });
        this._titleLabel.set_halign(Gtk.Align.START);
        hbox.pack_start(this._titleLabel, false, false, 0);

        this._spinner = new Gtk.Spinner();
        hbox.pack_start(this._spinner, false, false, 0);
        this._spinner.start();

        this._typeLabel = new Gtk.Label();
        this._typeLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._typeLabel, false, false, 0);

        this._sizeLabel = new Gtk.Label();
        this._sizeLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._sizeLabel, false, false, 0);

        this._dateLabel = new Gtk.Label();
        this._dateLabel.set_halign(Gtk.Align.START);
        vbox.pack_start(this._dateLabel, false, false, 0);

        this._applyLabels();

        this.connect('destroy', this._onDestroy.bind(this));
    },

    _applyLabels : function() {
        let titleStr =
            '<b><big>' +
            ((this._fileLoader.name) ? (this._fileLoader.name) : (this._fileLoader.file.get_basename()))
            + '</big></b>';
        this._titleLabel.set_markup(titleStr);

        if (this._fileLoader.get_file_type() != Gio.FileType.DIRECTORY) {
            let typeStr =
                '<small><b>' + _("Type") + '  </b>' +
                ((this._fileLoader.contentType) ? (this._fileLoader.contentType) : (_("Loading…")))
                + '</small>';
            this._typeLabel.set_markup(typeStr);
        } else {
            this._typeLabel.hide();
        }

        let sizeStr =
            '<small><b>' + _("Size") + '  </b>' +
            ((this._fileLoader.size) ? (this._fileLoader.size) : (_("Loading…")))
             + '</small>';
        this._sizeLabel.set_markup(sizeStr);

        let dateStr =
            '<small><b>' + _("Modified") + '  </b>' +
             ((this._fileLoader.time) ? (this._fileLoader.time) : (_("Loading…")))
             + '</small>';
        this._dateLabel.set_markup(dateStr);
    },

    _updateIcon: function(icon) {
        let iconTheme = Gtk.IconTheme.get_default();
        let iconInfo = iconTheme.lookup_by_gicon_for_scale(icon, 256,
            this._image.scale_factor, 0);
        if (!iconInfo)
            return;

        try {
            let surface = iconInfo.load_surface(this._image.get_window());
            this._image.surface = surface;
        } catch (e) {
            logError(e, `Error loading surface for icon ${icon.to_string()}`);
        }
    },

    _onFileInfoChanged : function() {
        if (!this._fileLoader.get_loading()) {
            this._spinner.stop();
            this._spinner.hide();
        }

        if (this._fileLoader.icon)
            this._updateIcon(this._fileLoader.icon);

        this._applyLabels();
    },

    _onDestroy : function() {
        if (this._fileLoader) {
            this._fileLoader.disconnect(this._fileLoaderId);
            this._fileLoaderId = 0;

            this._fileLoader.stop();
            this._fileLoader = null;
        }
    },

    get resizePolicy() {
        return Renderer.ResizePolicy.NAT_SIZE;
    }
});
