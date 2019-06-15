const {GObject, Gtk} = imports.gi;

var ResizePolicy = {
    MAX_SIZE: 0,
    NAT_SIZE: 1,
    SCALED: 2,
    STRETCHED: 3
};

var RendererToolbar = GObject.registerClass({
    CssName: 'toolbar',
}, class RendererToolbar extends Gtk.Box {
    _init() {
        super._init({ halign: Gtk.Align.CENTER,
                      hexpand: true });
        this.get_style_context().add_class('osd');
    }
});
