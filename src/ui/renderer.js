const {GLib, GObject, Gtk} = imports.gi;

const Constants = imports.util.constants;
const Utils = imports.ui.utils;

var ResizePolicy = {
    MAX_SIZE: 0,
    NAT_SIZE: 1,
    SCALED: 2,
    STRETCHED: 3
};

var Renderer = GObject.registerClass({
    Requires: [Gtk.Widget],
    Properties: {
        fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                              GObject.ParamFlags.READABLE,
                                              false),
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false)
    },
    Signals: {
        'error': { param_types: [GLib.Error.$gtype] }
    }
}, class Renderer extends GObject.Interface {
    isReady() {
        this._ready = true;
        this.notify('ready');
    }

    populateToolbar() {
        // do nothing, this is optional
    }

    toggleFullscreen() {
        if (!this.canFullscreen)
            return;

        this._fullscreen = !this.fullscreen;
        this.notify('fullscreen');
    }

    get canFullscreen() {
        // by default, we can fullscreen if we're resizable
        return this.resizable;
    }

    get fullscreen() {
        return !!this._fullscreen;
    }

    get ready() {
        return !!this._ready;
    }

    get resizable() {
        return true;
    }

    get resizePolicy() {
        return ResizePolicy.MAX_SIZE;
    }
});
