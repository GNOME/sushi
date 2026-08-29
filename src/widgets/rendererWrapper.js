/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi developers
 *
 * Authors: Peter Eisenmann <p3732@getgoogleoff.me>
 */

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import {ResizePolicy} from '../core/renderer.js';

import {getRendererToolbar} from '../core/renderer.js';

export class RendererWrapper extends Adw.Bin {
    static {
        GObject.registerClass({
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/rendererWrapper.ui',
            InternalChildren: ['revealer', 'overlay'],
        }, this);
    }

    #renderer;
    #resizePolicy;
    #getMaxSize;

    /** @param {import('../core/renderer').Renderer} renderer
     *  @param {() => [number, number]} getMaxSize
     *  @param {import('../util/hoverManager.js').HoverManager} hoverManager  */
    constructor(renderer, getMaxSize, hoverManager) {
        super();

        this.#renderer = renderer;
        this.#resizePolicy = renderer.resizePolicy; // cache the policy. changing it is not supported.
        this.#getMaxSize = getMaxSize;

        this.set_layout_manager(null);

        const toolbar = getRendererToolbar(renderer);
        this._overlay.set_child(renderer);
        if (toolbar) {
            this._revealer.set_child(toolbar);
            hoverManager.setRevealer(this._revealer);
        } else {
            hoverManager.setRevealer(null);
        }
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
            return measureMaxSize(child, orientation, this.#getMaxSize);
        case ResizePolicy.NAT_SIZE:
            return child.measure(orientation, forSize);
        case ResizePolicy.SCALED:
            return measureScaledSize(child, orientation, this.#getMaxSize);
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

const measureMaxSize = (child, orientation, getMaxSize) => {
    const [childMin] = child.get_preferred_size();
    // by using `Math.max()` we ensure that min <= nat
    const nat = Math.max(
        getLength(childMin, orientation),
        getMaxSize()[orientation]);
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

const measureScaledSize = (child, orientation, getMaxSize) => {
    const [childMinReq, childNatReq] = child.get_preferred_size();
    const childMin = [childMinReq.width, childMinReq.height];
    const childNat = [childNatReq.width, childNatReq.height];
    const max = getMaxSize();
    return getScaledSize(childMin, childNat, max, orientation);
};

const getScaledSize = (childMin, childNat, max, orientation) => {
    if (childNat[0] <= max[0] && childNat[1] <= max[1]) {
        return [childMin[orientation], childNat[orientation], -1, -1];
    } else {
        // scale by smaller ratio of width or height
        const ratio = Math.min(max[0] / childNat[0], max[1] / childNat[1]);
        const nat = childNat.map(size => Math.floor(size * ratio));
        const min = childMin.map((size, index) => Math.min(size, nat[index]));
        return [min[orientation], nat[orientation], -1, -1];
    }
};

const getLength = (requisition, orientation) =>
    orientation === Gtk.Orientation.HORIZONTAL
        ? requisition.width
        : requisition.height;
