// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import Sushi from 'gi://Sushi';

import {Klass as PdfRenderer} from './pdf.js';
import * as Libreoffice from './libreoffice.js';

PdfRenderer.convertLibreoffice = (renderer, file) => {
    Sushi.convert_libreoffice(file, renderer.cancellable, (o, res) => {
        try {
            const convertedFile = Sushi.convert_libreoffice_finish(res);
            renderer._loadFile(convertedFile);
        } catch (e) {
            renderer.emit('error', e);
        }
    });
};

export const Klass = PdfRenderer;

export const contentTypes = Libreoffice.isAvailable() ? [] : Libreoffice.officeTypes;
