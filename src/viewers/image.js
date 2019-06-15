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

const {Gdk, GdkPixbuf, GLib, GObject, Gtk} = imports.gi;

const Mainloop = imports.mainloop;

const Renderer = imports.ui.renderer;
const Utils = imports.ui.utils;

var Klass = GObject.registerClass({
    Implements: [Renderer.Renderer],
    Properties: {
        fullscreen: GObject.ParamSpec.boolean('fullscreen', '', '',
                                              GObject.ParamFlags.READABLE,
                                              false),
        ready: GObject.ParamSpec.boolean('ready', '', '',
                                         GObject.ParamFlags.READABLE,
                                         false)
    },
}, class ImageRenderer extends Gtk.DrawingArea {
    _init(file) {
        super._init();

        this._pix = null;
        this._scaledSurface = null;
        this._timeoutId = 0;

        this._createImageTexture(file);

        this.connect('destroy', this._onDestroy.bind(this));
    }

    vfunc_get_preferred_width() {
        return [1, this._pix ? this._pix.get_width() : 1];
    }

    vfunc_get_preferred_height() {
        return [1, this._pix ? this._pix.get_height() : 1];
    }

    vfunc_size_allocate(allocation) {
        super.vfunc_size_allocate(allocation);
        this._ensureScaledPix();
    }

    vfunc_draw(context) {
        if (!this._scaledSurface)
            return false;

        let width = this.get_allocated_width();
        let height = this.get_allocated_height();

        let scaleFactor = this.get_scale_factor();
        let offsetX = (width - this._scaledSurface.getWidth() / scaleFactor) / 2;
        let offsetY = (height - this._scaledSurface.getHeight() / scaleFactor) / 2;

        context.setSourceSurface(this._scaledSurface, offsetX, offsetY);
        context.paint();
        return false;
    }

    _createImageTexture(file) {
        file.read_async(GLib.PRIORITY_DEFAULT, null, (obj, res) => {
            try {
                let stream = obj.read_finish(res);
                this._textureFromStream(stream);
            } catch (e) {
                logError(e, `Unable to read image file ${file.get_uri()}`);
            }
        });
    }

    _ensureScaledPix() {
        if (!this._pix)
            return;

        let scaleFactor = this.get_scale_factor();
        let width = this.get_allocated_width() * scaleFactor;
        let height = this.get_allocated_height() * scaleFactor;

        // Scale original to fit, if necessary
        let origWidth = this._pix.get_width();
        let origHeight = this._pix.get_height();

        let scaleX = width / origWidth;
        let scaleY = height / origHeight;
        let scale = Math.min(scaleX, scaleY);

        let newWidth = Math.floor(origWidth * scale);
        let newHeight = Math.floor(origHeight * scale);

        let scaledWidth = this._scaledSurface ? this._scaledSurface.getWidth() : 0;
        let scaledHeight = this._scaledSurface ? this._scaledSurface.getHeight() : 0;

        if (newWidth != scaledWidth || newHeight != scaledHeight) {
            let scaledPixbuf = this._pix.scale_simple(newWidth, newHeight,
                                                      GdkPixbuf.InterpType.BILINEAR);
            this._scaledSurface = Gdk.cairo_surface_create_from_pixbuf(scaledPixbuf,
                                                                       scaleFactor,
                                                                       this.get_window());
        }
    }

    _setPix(pix) {
        this._pix = pix;
        this._scaledSurface = null;

        this.queue_resize();
        this.isReady();
    }

    _textureFromStream(stream) {
        GdkPixbuf.PixbufAnimation.new_from_stream_async(stream, null, (obj, res) => {
            let anim = GdkPixbuf.PixbufAnimation.new_from_stream_finish(res);

            this._iter = anim.get_iter(null);
            if (!anim.is_static_image())
                this._startTimeout();

            this._setPix(this._iter.get_pixbuf().apply_embedded_orientation());

            stream.close_async(GLib.PRIORITY_DEFAULT, null, (obj, res) => {
                try {
                    obj.close_finish(res);
                } catch (e) {
                    logError(e, 'Unable to close the stream');
                }
            });
         });
    }

    get resizePolicy() {
        return Renderer.ResizePolicy.SCALED;
    }

    _startTimeout() {
        this._timeoutId = Mainloop.timeout_add(
            this._iter.get_delay_time(), this._advanceImage.bind(this));
    }

    populateToolbar(toolbar) {
        let toolbarZoom = Utils.createFullscreenButton(this);
        toolbar.add(toolbarZoom);
    }

    _onDestroy() {
        /* We should do the check here because it is possible
         * that we never created a source if our image is
         * not animated. */
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
    }

    _advanceImage() {
        this._iter.advance(null);
        this._setPix(this._iter.get_pixbuf().apply_embedded_orientation());
        return true;
    }
});

var mimeTypes = [];
let formats = GdkPixbuf.Pixbuf.get_formats();
for (let idx in formats)
    mimeTypes = mimeTypes.concat(formats[idx].get_mime_types());
