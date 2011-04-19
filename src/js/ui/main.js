const Gettext = imports.gettext;

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;

const Application = imports.ui.application;
const Path = imports.util.path;

function run() {
    Gettext.bindtextdomain("sushi", Path.LOCALE_DIR);

    GLib.set_application_name("Sushi");

    let application = new Application.Application();

    Gtk.main();
}
