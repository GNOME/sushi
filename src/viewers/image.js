/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gly from 'gi://Gly';
import GlyGtk4 from 'gi://GlyGtk4';

import {Renderer, ResizePolicy} from '../core/renderer.js';
import {isCancelledError} from '../util/error.js';
import {SourceId} from '../util/source.js';

Gio._promisify(Gly.Loader.prototype, 'load_async', 'load_finish');
Gio._promisify(Gly.Image.prototype, 'next_frame_async', 'next_frame_finish');

const MICROS_PER_MILLIS = 1_000;

export const Klass = class ImageRenderer extends Gtk.Picture {
    static {
        GObject.registerClass({
            Implements: [Renderer],
        }, this);
    }

    #nextFrameTimeout = new SourceId();

    _handleClick(numClicks) {
        if (numClicks === 2)
            this.activate_action('win.fullscreen', null);
    }

    constructor(file, _fileInfo, constructProperties = {}) {
        super({
            ...constructProperties,
            content_fit: Gtk.ContentFit.SCALE_DOWN,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
        });

        this._loadFile(file)
            .catch(error => this.markFailed(error));

        const click_handler = new Gtk.GestureClick();
        click_handler.connect_object(
            'pressed',
            (_, numClicks) => this._handleClick(numClicks),
            this, GObject.ConnectFlags.DEFAULT
        );
        this.add_controller(click_handler);

        this.markInitialized();
    }

    stop() {
        this.#nextFrameTimeout.remove();
    }

    cleanup() {
        this.set_paintable(null);
    }

    async _loadFile(file) {
        const loader = Gly.Loader.new(file);
        const image = await loader.load_async(this.cancellable);
        this._image = image;
        this._imageWidth = image.get_width();
        this._imageHeight = image.get_height();
        await this.#showNextFrame();
        this.markReady();
    }

    async #showNextFrame() {
        const frame = await this._image.next_frame_async(this.cancellable);
        const texture = GlyGtk4.frame_get_texture(frame);
        this._texture = texture;
        this.set_paintable(texture);
        const delayInMicroseconds = frame.get_delay();
        if (delayInMicroseconds)
            this.#queueNextFrame(Math.max(delayInMicroseconds / MICROS_PER_MILLIS, 1));
    }

    /** @param {number} delayInMilliseconds */
    #queueNextFrame(delayInMilliseconds) {
        this.#nextFrameTimeout.addTimeout(GLib.PRIORITY_DEFAULT, delayInMilliseconds, () => {
            this.#showNextFrame().catch(error => {
                if (!isCancelledError(error))
                    console.warn('Failed to show next image frame', error);
            });
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
        const scaleFactor = this._getFractionalScaleFactor();
        return [
            (this._texture?.get_width() ?? this._imageWidth) / scaleFactor,
            (this._texture?.get_height() ?? this._imageHeight) / scaleFactor,
        ];
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

export const contentTypes = Gly.Loader.get_mime_types();
