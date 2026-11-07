/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi developers
 *
 * Authors: Peter Eisenmann <p3732@getgoogleoff.me>
 */

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import {ResizePolicy} from '../core/renderer.js';

import {getRendererToolbar} from '../core/renderer.js';

const WINDOW_MAX_PERCENT_W = 0.5;
const WINDOW_MAX_PERCENT_H = 0.5;

export class RendererWrapper extends Adw.Bin {
    static {
        GObject.registerClass({
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/rendererWrapper.ui',
            InternalChildren: ['revealer', 'overlay'],
        }, this);
    }

    #renderer;
    #resizePolicy;

    /** @param {import('../core/renderer').Renderer} renderer
     *  @param {import('../util/hoverManager.js').HoverManager} hoverManager  */
    constructor(renderer, hoverManager) {
        super();

        this.#renderer = renderer;
        this.#resizePolicy = renderer.resizePolicy; // cache the policy. changing it is not supported.

        this.set_layout_manager(null);

        const toolbar = getRendererToolbar(renderer);
        this._overlay.set_child(renderer);
        if (toolbar) {
            this._revealer.set_child(toolbar);
            this._revealer.set_visible(true);
            hoverManager.setRevealer(this._revealer);
        } else {
            this._revealer.set_visible(false);
            hoverManager.setRevealer(null);
        }
    }

    /** @returns {[number, number]} */
    #getMaxSize() {
        const fallback = [640, 480];
        const display = Gdk.Display.get_default();
        const surface = this.get_native()?.get_surface();
        if (surface == null)
            return fallback;
        const monitor = display.get_monitor_at_surface(surface);
        if (monitor == null)
            return fallback;
        const geometry = monitor.get_geometry();

        // Sanitize unexpected values
        if (geometry.width > 100_000 || geometry.height > 100_000)
            return fallback;

        return [
            Math.floor(geometry.width * WINDOW_MAX_PERCENT_W),
            Math.floor(geometry.height * WINDOW_MAX_PERCENT_H),
        ];
    }

    /** @returns {Gtk.SizeRequestMode} */
    vfunc_get_request_mode() {
        switch (this.#resizePolicy) {
        case ResizePolicy.MAX_SIZE:
        case ResizePolicy.STATUS_PAGE:
        case ResizePolicy.SCALED:
            return Gtk.SizeRequestMode.CONSTANT_SIZE;
        case ResizePolicy.NAT_SIZE:
        default:
            return this.#renderer.get_request_mode();
        }
    }

    /** @param {Gtk.Orientation} orientation
     *  @param {number} forSize
     *  @return {[number, number, number, number]} */
    vfunc_measure(orientation, forSize) {
        const child = this.get_child();
        if (!child.should_layout())
            return [-1, -1, -1, -1];
        switch (this.#resizePolicy) {
        case ResizePolicy.MAX_SIZE:
            return measureMaxSize(child, orientation, this.#getMaxSize());
        case ResizePolicy.NAT_SIZE:
            return child.measure(orientation, forSize);
        case ResizePolicy.SCALED:
            return measureScaledSize(child, orientation, this.#getMaxSize());
        case ResizePolicy.STATUS_PAGE:
            return measureStatusPage(child, orientation);
        default:
            console.warn(`Renderer uses unknown resize policy '${this.#resizePolicy}'`);
            return child.measure(orientation, forSize);
        }
    }

    vfunc_size_allocate(width, height, baseline) {
        const child = this.get_child();
        if (child != null && child.should_layout())
            child.allocate(width, height, baseline, null);
    }
}

const measureMaxSize = (child, orientation, maxSize) => {
    const [childMin] = child.get_preferred_size();
    // by using `Math.max()` we ensure that min <= nat
    const nat = Math.max(
        getLength(childMin, orientation),
        maxSize[orientation]);
    return [childMin[orientation], nat, -1, -1];
};

const STATUS_PAGE_SIZE = [400, 420];
const measureStatusPage = (child, orientation) => {
    const [childMin] = child.get_preferred_size();
    const min = getLength(childMin, orientation);
    // by using `Math.max()` we ensure that min <= nat
    const nat = Math.max(min, STATUS_PAGE_SIZE[orientation]);
    return [min, nat, -1, -1];
};

const measureScaledSize = (child, orientation, max) => {
    const [childMinReq, childNatReq] = child.get_preferred_size();
    const childMin = [childMinReq.width, childMinReq.height];
    const childNat = [childNatReq.width, childNatReq.height];

    return getScaledSize(childMin, childNat, max, orientation);
};

const MAX_STRETCH = 1.6;

const getScaledSize = (childMin, childNat, max, orientation) => {
    // Limit content to the area of the max size, regardless of its orientation
    const areaRatio = Math.sqrt((max[0] * max[1]) / (childNat[0] * childNat[1]));
    const widthRatio = (max[0] * MAX_STRETCH) / childNat[0];
    const heightRatio = (max[1] * MAX_STRETCH) / childNat[1];
    const ratio = Math.min(areaRatio, widthRatio, heightRatio);

    if (ratio >= 1) {
        return [childMin[orientation], childNat[orientation], -1, -1];
    } else {
        const nat = childNat.map(size => Math.floor(size * ratio));
        const min = childMin.map((size, index) => Math.min(size, nat[index]));
        return [min[orientation], nat[orientation], -1, -1];
    }
};

const getLength = (requisition, orientation) =>
    orientation === Gtk.Orientation.HORIZONTAL
        ? requisition.width
        : requisition.height;
