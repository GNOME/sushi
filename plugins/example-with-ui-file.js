/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors */

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

import {
    Renderer, ResizePolicy, resolveRelativePath, setupActions,
} from 'resource://org/gnome/NautilusPreviewer/plugin-api-1.js';

export const Klass = class ExampleRendererWithUiFile extends Adw.Bin {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Template: resolveRelativePath(import.meta.url, './example-with-ui-file.ui'),
        }, this);
    }

    constructor(file, fileInfo, constructProperties = {}) {
        super(constructProperties);

        setupActions(this, 'example', [
            ['some-action', () => this.#callback()],
        ]);

        this.markReady();
    }

    get resizePolicy() {
        return ResizePolicy.STATUS_PAGE;
    }

    #callback() {
        print('test');
    }
};

export const contentTypes = [
    'your/filetype',
];
