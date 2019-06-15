const {GObject, Gtk} = imports.gi;

var ResizePolicy = {
    MAX_SIZE: 0,
    NAT_SIZE: 1,
    SCALED: 2,
    STRETCHED: 3
};

var Renderer = GObject.registerClass({
    Requires: [Gtk.Widget],
    Properties: {
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false)
    },
}, class Renderer extends GObject.Interface {
    isReady() {
        this._ready = true;
        this.notify('ready');
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

var RendererToolbar = GObject.registerClass({
    CssName: 'toolbar',
}, class RendererToolbar extends Gtk.Box {
    _init() {
        super._init({ halign: Gtk.Align.CENTER,
                      hexpand: true });
        this.get_style_context().add_class('osd');
    }
});
