/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
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

export async function main(argv) {
    const application = new Application({
        application_id: pkg.name,
        flags: Gio.ApplicationFlags.IS_SERVICE,
        inactivity_timeout: 12000,
    });
    if (GLib.getenv('SUSHI_PERSIST'))
        application.hold();
    await application.runAsync(argv);
}
