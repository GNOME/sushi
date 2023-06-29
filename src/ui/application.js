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

const {Gio, GLib, GObject, Gtk} = imports.gi;

const ByteArray = imports.byteArray;

const MainWindow = imports.ui.mainWindow;

var NautilusPreviewerSkeleton = class {
    constructor(application, resource) {
        this.application = application;

        let bytes = Gio.resources_lookup_data(resource, 0);
        this._skeleton = Gio.DBusExportedObject.wrapJSObject(
            ByteArray.toString(bytes.toArray()), this);
    }

    get impl() {
        return this._skeleton;
    }

    export(connection, path) {
        try {
            this._skeleton.export(connection, path);
        } catch (e) {
            logError(e, 'Failed to export NautilusPreviewer DBus interface');
        }
    }

    unexport(connection) {
        if (this._skeleton && this._skeleton.has_connection(connection))
            this._skeleton.unexport_from_connection(connection);
    }

    Close() {
        this.application.close();
    }
}

var NautilusPreviewer1Skeleton = class extends NautilusPreviewerSkeleton {
    constructor(application) {
        super(application, '/org/gnome/NautilusPreviewer/org.gnome.NautilusPreviewer.xml');
    }

    ShowFile(uri, xid, closeIfAlreadyShown) {
        let handle = 'x11:%d'.format(xid);
        this.application.showFile(uri, handle, closeIfAlreadyShown);
    }
}

var NautilusPreviewer2Skeleton = class extends NautilusPreviewerSkeleton {
    constructor(application) {
        super(application, '/org/gnome/NautilusPreviewer/org.gnome.NautilusPreviewer2.xml');
    }

    ShowFile(uri, windowHandle, closeIfAlreadyShown) {
        this.application.showFile(uri, windowHandle, closeIfAlreadyShown);
    }
}

var Application = GObject.registerClass(class Application extends Gtk.Application {
    vfunc_startup() {
        super.vfunc_startup();

        this._defineStyleAndThemes();
    }

    vfunc_dbus_register(connection, path) {
        let actualPath = `/org/gnome/${pkg.name.split('.').at(-1)}`;

        this._skeleton = new NautilusPreviewer1Skeleton(this);
        this._skeleton2 = new NautilusPreviewer2Skeleton(this);

        this._skeleton.export(connection, actualPath);
        this._skeleton2.export(connection, actualPath);

        return super.vfunc_dbus_register(connection, path);
    }

    vfunc_dbus_unregister(connection, path) {
        this._skeleton.unexport(connection);
        this._skeleton2.unexport(connection);

        return super.vfunc_dbus_unregister(connection, path);
    }

    vfunc_activate() {
    }

    _ensureMainWindow() {
        if (this._mainWindow)
            return;

        this._mainWindow = new MainWindow.MainWindow(this);
        if (pkg.name.endsWith('Devel'))
            this._mainWindow.get_style_context().add_class('devel');

        this._skeleton2.impl.emit_property_changed(
            'Visible', new GLib.Variant('b', true));

        this._mainWindow.connect('destroy', () => {
            this._mainWindow = null;
            this._skeleton2.impl.emit_property_changed(
                'Visible', new GLib.Variant('b', false));
        });
    }

    _defineStyleAndThemes() {
        let settings = Gtk.Settings.get_default();
        settings.gtk_application_prefer_dark_theme = true;
    }

    close() {
        if (this._mainWindow)
            this._mainWindow.destroy();
    }

    emitSelectionEvent(direction) {
        this._skeleton2.impl.emit_signal(
            'SelectionEvent', new GLib.Variant('(u)', [direction]));
    }

    updateParentHandle(handle) {
        this._skeleton2.impl.emit_property_changed(
            'ParentHandle', new GLib.Variant('s', handle));
    }

    showFile(uri, windowHandle, closeIfAlreadyShown) {
        this._ensureMainWindow();

        let file = Gio.file_new_for_uri(uri);
        if (closeIfAlreadyShown &&
            this._mainWindow.file &&
            this._mainWindow.file.equal(file)) {
            this._mainWindow.destroy();
        } else {
            this._mainWindow.setParent(windowHandle);
            this._mainWindow.setFile(file);
        }
    }
});
