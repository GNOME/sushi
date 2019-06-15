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
pkg.initGettext();
pkg.initFormat();
pkg.require({
    EvinceDocument: '3.0',
    EvinceView: '3.0',
    Gdk: '3.0',
    GdkX11: '3.0',
    Gio: '2.0',
    GLib: '2.0',
    GObject: '2.0',
    Gst: '1.0',
    Gtk: '3.0',
    GtkSource: '4',
    Pango: '1.0',
    Sushi: '1.0',
    WebKit2: '4.0',
});

const Application = imports.ui.application;

const SUSHI_DBUS_NAME = 'org.gnome.NautilusPreviewer';

function main(argv) {
    let application = new Application.Application({ application_id: SUSHI_DBUS_NAME });
    return application.run(argv);
}
