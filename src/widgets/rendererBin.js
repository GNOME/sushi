// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import {ResizePolicy} from '../core/renderer.js';

export class RendererBin extends Adw.Bin {
    static {
        GObject.registerClass(this);
    }

    #renderer;
    #getMaxSize;

    /** @param {import('../core/renderer').Renderer} renderer
     *  @param {(orientation?: Gtk.Orientation) => number} getMaxSize */
    constructor(renderer, getMaxSize, constructProperties = {}) {
        const sizeRequest = renderer.resizePolicy === ResizePolicy.STATUS_PAGE
            ? {widthRequest: 400, heightRequest: 420}
            : {};
        super({...sizeRequest, ...constructProperties});

        this.#renderer = renderer;
        this.#getMaxSize = getMaxSize;

        this.set_layout_manager(null);
        this.set_child(renderer);
    }

    /** @param {Gtk.Orientation} orientation
     *  @param {number} forSize
     *  @return {[number, number, number, number]} */
    vfunc_measure(orientation, forSize) {
        const child = this.get_child();
        if (!child.should_layout())
            return [-1, -1, -1, -1];
        switch (this.#renderer.resizePolicy) {
        case ResizePolicy.MAX_SIZE:
            return measureMaxSize(child, orientation, forSize, this.#getMaxSize);
        case ResizePolicy.NAT_SIZE:
        case ResizePolicy.STATUS_PAGE: // min size handled using width-/heightRequest
            return child.measure(orientation, forSize);
        case ResizePolicy.SCALED:
            return measureScaledSize(child, orientation, forSize, this.#getMaxSize);
        default:
            console.warn(`Renderer uses unknown resize policy '${this.#renderer.resizePolicy}'`);
            return child.measure(orientation, forSize);
        }
    }

    vfunc_size_allocate(width, height, baseline) {
        const child = this.get_child();
        if (child != null && child.should_layout())
            child.allocate(width, height, baseline, null);
    }
}

/** @param {Gtk.Widget}
 *  @param {Gtk.Orientation} orientation
 *  @param {number} forSize
 *  @param {(orientation: Gtk.Orientation) => number} getMaxSize
 *  @return {[number, number, number, number]} */
const measureMaxSize = (child, orientation, forSize, getMaxSize) => {
    const [childMin] = child.measure(orientation, forSize);
    const nat = Math.max(childMin, getMaxSize(orientation));
    return [childMin, nat, -1, -1];
};

/** @param {Gtk.Widget}
 *  @param {Gtk.Orientation} orientation
 *  @param {number} _forSize
 *  @param {(orientation?: Gtk.Orientation) => number} getMaxSize
 *  @return {[number, number, number, number]} */
const measureScaledSize = (child, orientation, _forSize, getMaxSize) => {
    const [childMinReq, childNatReq] = child.get_preferred_size();
    const childMin = [childMinReq.width, childMinReq.height];
    const childNat = [childNatReq.width, childNatReq.height];
    const max = getMaxSize();

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
