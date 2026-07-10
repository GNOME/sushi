/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
const ByteArray = imports.byteArray;

import {MainWindow} from './mainWindow.js';

class NautilusPreviewerSkeleton {
    constructor(application, resource) {
        this.application = application;

        const bytes = Gio.resources_lookup_data(resource, 0);
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
            console.error(e, 'Failed to export NautilusPreviewer DBus interface');
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

class NautilusPreviewer2Skeleton extends NautilusPreviewerSkeleton {
    constructor(application) {
        super(application, '/org/gnome/NautilusPreviewer/org.gnome.NautilusPreviewer2.xml');
    }

    ShowFile(uri, windowHandle, closeIfAlreadyShown, activationToken) {
        this.application.showFile(
            uri, windowHandle, closeIfAlreadyShown, activationToken);
    }
}

export class Application extends Adw.Application {
    static {
        GObject.registerClass(this);
    }

    vfunc_dbus_register(connection, path) {
        const actualPath = `/org/gnome/${pkg.name.split('.').at(-1)}`;

        this._skeleton2 = new NautilusPreviewer2Skeleton(this);
        this._skeleton2.export(connection, actualPath);

        return super.vfunc_dbus_register(connection, path);
    }

    vfunc_dbus_unregister(connection, path) {
        this._skeleton2.unexport(connection);

        return super.vfunc_dbus_unregister(connection, path);
    }

    vfunc_activate() {
    }

    _getActions() {
        if (!this._actions) {
            this._actions = [];
            const addAction = (name, accels, callback) => {
                const action = new Gio.SimpleAction({name});
                action.connect_object('activate', callback, this, GObject.ConnectFlags.DEFAULT);
                this.set_accels_for_action(`win.${name}`, accels);
                this._actions.push(action);
            };
            const directionCallback = direction => {
                return () => this.emitSelectionEvent(direction);
            };
            addAction('quit', ['q', 'Escape', 'space'], () => this.close());
            addAction('fullscreen', ['f', 'F11'], () => this._mainWindow.toggleFullscreen());

            addAction('select-left', ['Left'], directionCallback(Gtk.DirectionType.LEFT));
            addAction('select-right', ['Right'], directionCallback(Gtk.DirectionType.RIGHT));
            addAction('select-up', ['Up'], directionCallback(Gtk.DirectionType.UP));
            addAction('select-down', ['Down'], directionCallback(Gtk.DirectionType.DOWN));
        }

        return this._actions;
    }

    _ensureMainWindow() {
        if (this._mainWindow)
            return;

        this._mainWindow = new MainWindow(this, this._getActions());
        if (pkg.name.endsWith('Devel'))
            this._mainWindow.get_style_context().add_class('devel');

        this._skeleton2.impl.emit_property_changed(
            'Visible', new GLib.Variant('b', true));

        this._mainWindow.connect('close-request', () => {
            this._mainWindow = null;
            this._skeleton2.impl.emit_property_changed(
                'Visible', new GLib.Variant('b', false));
        });
    }

    close() {
        if (this._mainWindow)
            this._mainWindow.close();
    }

    emitSelectionEvent(direction) {
        this._skeleton2.impl.emit_signal(
            'SelectionEvent', new GLib.Variant('(u)', [direction]));
    }

    updateParentHandle(handle) {
        this._skeleton2.impl.emit_property_changed(
            'ParentHandle', new GLib.Variant('s', handle));
    }

    showFile(uri, windowHandle, closeIfAlreadyShown, activationToken = '') {
        this._ensureMainWindow();

        if (activationToken)
            this._mainWindow.set_startup_id(activationToken);


        const file = Gio.file_new_for_uri(uri);
        if (closeIfAlreadyShown &&
            this._mainWindow.file &&
            this._mainWindow.file.equal(file)) {
            this._mainWindow.close();
        } else {
            this._mainWindow.setParent(windowHandle);
            this._mainWindow.setFile(file);
            this._mainWindow.present();
        }
    }
}
