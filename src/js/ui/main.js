// standard imports
const Gettext = imports.gettext;

// gi imports
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;

// ui imports
const Application = imports.ui.application;

// util imports
const Path = imports.util.path;

function run() {
    Gettext.bindtextdomain("nautilus-preview", Path.LOCALE_DIR);

    GLib.set_application_name("Nautilus Preview");

    let application = new Application.Application();

    Gtk.main();
}
