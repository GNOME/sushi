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

import 'gi://Adw?version=1';
import 'gi://GLib?version=2.0';
import 'gi://GObject?version=2.0';
import 'gi://Gdk?version=4.0';
import 'gi://Gio?version=2.0';
import 'gi://GioUnix?version=2.0';
import 'gi://Gly?version=2';
import 'gi://GlyGtk4?version=2';
import 'gi://Gst?version=1.0';
import 'gi://GstTag?version=1.0';
import 'gi://Gtk?version=4.0';
import 'gi://GtkSource?version=5';
import 'gi://Pango?version=1.0';
import 'gi://PapersDocument?version=4.0';
import 'gi://PapersView?version=4.0';
import 'gi://Soup?version=3.0';
import 'gi://Sushi?version=1.0';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Application} from './application.js';

pkg.initGettext();
pkg.initFormat();

export async function main(argv) {
    let application = new Application({ application_id: pkg.name,
                                        flags: Gio.ApplicationFlags.IS_SERVICE,
                                        inactivity_timeout: 12000 });
    if (GLib.getenv('SUSHI_PERSIST'))
        application.hold();
    await application.runAsync(argv);
}
