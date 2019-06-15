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

const {Gdk, Gio, GLib, GObject, Gtk} = imports.gi;

const MainWindow = imports.ui.mainWindow;

const SUSHI_DBUS_PATH = '/org/gnome/NautilusPreviewer';

const SushiIface = '<node> \
<interface name="org.gnome.NautilusPreviewer"> \
<method name="ShowFile"> \
    <arg type="s" direction="in" name="uri" /> \
    <arg type="i" direction="in" name="xid" /> \
    <arg type="b" direction="in" name="closeIfAlreadyShown" /> \
</method> \
<method name="Close"> \
</method> \
</interface> \
</node>';

var Application = GObject.registerClass(class Application extends Gtk.Application {
    vfunc_startup() {
        super.vfunc_startup();

        this._defineStyleAndThemes();
        this._createMainWindow();
    }

    vfunc_dbus_register(connection, path) {
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(SushiIface, this);
        this._dbusImpl.export(connection, SUSHI_DBUS_PATH);

        return super.vfunc_dbus_register(connection, path);
    }

    vfunc_activate() {
    }

    _createMainWindow() {
        this._mainWindow =
            new MainWindow.MainWindow(this);
    }

    _defineStyleAndThemes() {
        let provider = new Gtk.CssProvider();
        provider.load_from_resource('/org/gnome/NautilusPreviewer/gtk-style.css');
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(),
                                                 provider,
                                                 600);

        let settings = Gtk.Settings.get_default();
        settings.gtk_application_prefer_dark_theme = true;
    }

    Close() {
        this._mainWindow.destroy();
    }

    ShowFile(uri, xid, closeIfAlreadyShown) {
        let file = Gio.file_new_for_uri(uri);
        if (closeIfAlreadyShown &&
            this._mainWindow.file &&
            this._mainWindow.file.equal(file)) {
            this._mainWindow.destroy();
            return;
        }
        this._mainWindow.setParent(xid);
        this._mainWindow.setFile(file);
    }
});