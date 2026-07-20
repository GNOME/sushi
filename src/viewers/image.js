/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gly from 'gi://Gly';
import GlyGtk4 from 'gi://GlyGtk4';

import {Renderer, ResizePolicy} from '../core/renderer.js';

Gio._promisify(Gly.Loader.prototype, 'load_async', 'load_finish');
Gio._promisify(Gly.Image.prototype, 'next_frame_async', 'next_frame_finish');

export const Klass = class ImageRenderer extends Gtk.Picture {
    static {
        GObject.registerClass({
            Implements: [Renderer],
        }, this);
    }

    _handleClick(numClicks) {
        if (numClicks === 2)
            this.activate_action('win.fullscreen', null);
    }

    constructor(file, _fileInfo, constructProperties = {}) {
        super({
            ...constructProperties,
            content_fit: Gtk.ContentFit.SCALE_DOWN,
        });

        this._loadFile(file)
            .catch(error => {
                if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED) &&
                    !this.getCancellable().is_cancelled())
                    this.emit('error', error);
            });

        const click_handler = new Gtk.GestureClick();
        click_handler.connect_object(
            'pressed',
            (_, numClicks) => this._handleClick(numClicks),
            this, GObject.ConnectFlags.DEFAULT
        );
        this.add_controller(click_handler);

        this.initialized();
    }

    cleanup() {
        this.set_paintable(null);
    }

    _loadFile(file) {
        const loader = Gly.Loader.new(file);
        const cancellable = this.getCancellable();
        return loader.load_async(cancellable)
            .then(image => {
                this._imageWidth = image.get_width();
                this._imageHeight = image.get_height();
                return image.next_frame_async(cancellable);
            })
            .then(frame => {
                const texture = GlyGtk4.frame_get_texture(frame);
                this._texture = texture;
                this.set_paintable(texture);
                this.isReady();
            });
    }

    vfunc_measure(orientation, _for_size) {
        const scaleFactor = this._getFractionalScaleFactor();
        const size = orientation === Gtk.Orientation.VERTICAL
            ? this._texture?.get_height() ?? this._imageHeight
            : this._texture?.get_width() ?? this._imageWidth;
        return [1, (size ?? scaleFactor) / scaleFactor, -1, -1];
    }

    get customSize() {
        return [this._imageWidth, this._imageHeight];
    }

    get resizePolicy() {
        return ResizePolicy.CUSTOM;
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.RAISED_BORDER;
    }

    /**
     * Similar to {@link Gtk.Widget.get_scale_factor} but returns
     * a fraction instead rounding up to the nearest integer.
     *
     * @returns {number} */
    _getFractionalScaleFactor() {
        const surface = this.get_native()?.get_surface();
        return surface?.get_scale() ?? 1;
    }
};

export const mimeTypes = Gly.Loader.get_mime_types();
