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

const {Gdk, Gio, GObject, Gtk, NautilusPreviewerDBus} = imports.gi;

const MainWindow = imports.ui.mainWindow;

var Application = GObject.registerClass(class Application extends Gtk.Application {
    vfunc_startup() {
        super.vfunc_startup();

        this._defineStyleAndThemes();
    }

    vfunc_dbus_register(connection, path) {
        this._skeleton = new NautilusPreviewerDBus.Skeleton();
        this._skeleton.connect('handle-close', this._close.bind(this));
        this._skeleton.connect('handle-show-file', this._showFile.bind(this));

        try {
            this._skeleton.export(connection, path);
        } catch (e) {
            logError(e, 'Failed to export NautilusPreviewer DBus interface');
        }

        return super.vfunc_dbus_register(connection, path);
    }

    vfunc_dbus_unregister(connection, path) {
        if (this._skeleton && this._skeleton.has_connection(connection))
            this._skeleton.unexport_from_connection(connection);

        return super.vfunc_dbus_unregister(connection, path);
    }

    vfunc_activate() {
    }

    _ensureMainWindow() {
        if (this._mainWindow)
            return;

        this._mainWindow = new MainWindow.MainWindow(this);
        this._mainWindow.connect('destroy', () => {
            this._mainWindow = null;
        });
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

    _close(skel, invocation) {
        if (this._mainWindow)
            this._mainWindow.destroy();

        invocation.return_value(null);
        return true;
    }

    _showFile(skel, invocation, uri, xid, closeIfAlreadyShown) {
        this._ensureMainWindow();

        let file = Gio.file_new_for_uri(uri);
        if (closeIfAlreadyShown &&
            this._mainWindow.file &&
            this._mainWindow.file.equal(file)) {
            this._mainWindow.destroy();
        } else {
            this._mainWindow.setParent(xid);
            this._mainWindow.setFile(file);
        }

        invocation.return_value(null);
        return true;
    }
});
