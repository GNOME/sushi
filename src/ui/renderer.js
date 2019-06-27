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

    get hasToolbar() {
        return true;
    }

    get moveOnClick() {
        return true;
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

    get toolbar() {
        if (!this.hasToolbar)
            return null;

        if (!this._toolbar) {
            this._toolbar = new RendererToolbar();
            this.connect('destroy', () => { this._toolbar.destroy(); });

            this.populateToolbar(this._toolbar.box);

            if (this.canFullscreen) {
                if (this._toolbar.box.get_children().length > 0)
                    this._toolbar.box.add(new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL }));

                this._toolbar.box.add(Utils.createFullscreenButton(this));
            }
        }

        return this._toolbar;
    }
});

var RendererToolbarBox = GObject.registerClass({
    CssName: 'toolbar',
}, class RendererToolbarBox extends Gtk.Box {
    _init() {
        super._init({ halign: Gtk.Align.CENTER,
                      hexpand: true });
        this.get_style_context().add_class('osd');
    }
});

var RendererToolbar = GObject.registerClass(class RendererToolbar extends Gtk.Revealer {
    _init() {
        this._revealTimeoutId = 0;

        super._init({ valign: Gtk.Align.END,
                      hexpand: true,
                      margin_bottom: Constants.TOOLBAR_SPACING,
                      margin_start: Constants.TOOLBAR_SPACING,
                      margin_end: Constants.TOOLBAR_SPACING,
                      transition_type: Gtk.RevealerTransitionType.CROSSFADE });

        this.box = new RendererToolbarBox();
        this.add(this.box);

        this.connect('destroy', this._onDestroy.bind(this));
    }

    resetTimeout() {
        if (this._revealTimeoutId == 0)
            this.reveal_child = true;

        this._removeRevealTimeout();
        this._revealTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT, 1500, this._onRevealTimeout.bind(this));
    }

    _onDestroy() {
        this._removeRevealTimeout();
    }

    _onRevealTimeout() {
        this._revealTimeoutId = 0;
        this.reveal_child = false;
        return false;
    }

    _removeRevealTimeout() {
        if (this._revealTimeoutId != 0) {
            GLib.source_remove(this._revealTimeoutId);
            this._revealTimeoutId = 0;
        }
    }
});
