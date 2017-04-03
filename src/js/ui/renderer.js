const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

var ResizePolicy = {
    MAX_SIZE: 0,
    NAT_SIZE: 1,
    SCALED: 2,
    STRETCHED: 3
};

var RendererToolbar = new Lang.Class({
    Name: 'RendererToolbar',
    Extends: Gtk.Box,
    CssName: 'toolbar',

    _init : function() {
        this.parent({ halign: Gtk.Align.CENTER,
                      hexpand: true });
        this.get_style_context().add_class('osd');
    }
});
