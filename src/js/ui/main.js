const Gettext = imports.gettext;

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;

const Application = imports.ui.application;
const Path = imports.util.path;
const Utils = imports.ui.utils;
const Tweener = imports.ui.tweener;

function run() {
    Gettext.bindtextdomain("sushi", Path.LOCALE_DIR);

    GLib.set_application_name("Sushi");

    let application = new Application.Application();

    let slowdownEnv = GLib.getenv('SUSHI_SLOWDOWN_FACTOR');
    if (slowdownEnv) {
        let factor = parseFloat(slowdownEnv);
        if (!isNaN(factor) && factor > 0.0)
            Utils.setSlowDownFactor(factor);
    }

    Tweener.init();

    Gtk.main();
}
