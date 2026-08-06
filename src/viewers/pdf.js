/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import PapersDocument from 'gi://PapersDocument';
import PapersView from 'gi://PapersView';
// eslint-disable-next-line no-restricted-properties
const Format = imports.format;

import {Renderer} from '../core/renderer.js';
import * as Image from './image.js';

let papersInitialized = false;

export const Klass = class PdfRenderer extends Adw.Bin {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/pdf.ui',
            InternalChildren: [
                'model', 'view', 'toolbarBack', 'toolbarForward', 'pageLabel',
                'toolbar',
            ],
        }, this);
    }

    constructor(file, fileInfo, constructProperties = {}) {
        if (!papersInitialized) {
            PapersDocument.init();
            papersInitialized = true;
        }
        GObject.type_ensure(PapersView.View);

        super(constructProperties);

        if (contentTypes.includes(fileInfo.get_content_type()))
            this._loadFile(file);
        else if (Klass.convertLibreoffice)
            Klass.convertLibreoffice(this, file);
        else
            this.emit('error', new GLib.Error('Unhandled document type'));

        this._defineActions();

        this.markInitialized();
    }

    stop() {
        this._job?.cancel();
        this._job = null;
    }

    get toolbar() {
        return this._toolbar;
    }

    _loadFile(file) {
        this._job = PapersView.JobLoad.new();
        this._job.set_uri(file.get_uri());

        const loadJobID = this._job.connect_object(
            'finished',
            job => {
                if (this.cancellable.is_cancelled())
                    return;
                job.disconnect(loadJobID);
                this._job = null;
                return this._onLoadJobFinished(job);
            },
            this, GObject.ConnectFlags.DEFAULT
        );
        this._job.scheduler_push_job(PapersView.JobPriority.PRIORITY_NONE);
    }

    _onLoadJobFinished(job) {
        const document = job.get_loaded_document();
        try {
            // the original C function has an out param for the error
            // which gets converted to an exception by GJS.
            job.is_succeeded();
        } catch (error) {
            this.emit('error', error);
            return;
        }

        this._model.set_document(document);

        this._model.connect_object(
            'page-changed',
            () => this._updatePageLabel(this._model),
            this, GObject.ConnectFlags.DEFAULT
        );
        this._updatePageLabel(this._model);
        this.markReady();
    }

    _defineActions() {
        const application = Gio.Application.get_default();
        const copyAction = new Gio.SimpleAction({name: 'copy'});
        copyAction.connect_object(
            'activate', () => this._view.copy(), this, GObject.ConnectFlags.DEFAULT
        );
        application.set_accels_for_action('pdf.copy', ['<control>c']);
        const actionGroup = new Gio.SimpleActionGroup();
        actionGroup.add_action(copyAction);
        this.insert_action_group('pdf', actionGroup);
    }

    _goNextPage() {
        this._view.next_page();
    }

    _goPreviousPage() {
        this._view.previous_page();
    }

    _updatePageLabel(model) {
        const currentPage = model.get_page();
        const totalPages = model.document.get_n_pages();

        this._toolbarBack.set_sensitive(currentPage > 0);
        this._toolbarForward.set_sensitive(currentPage < totalPages - 1);
        this._pageLabel.set_text(Format.vprintf(_('%d of %d'), [currentPage + 1, totalPages]));
        this._pageLabel.set_visible(true);
    }
};

const getPaperTypes = () => {
    const appInfo = GioUnix.DesktopAppInfo.new('org.gnome.Papers.desktop');
    // Papers might not be installed, fallback to only PDF
    let contentTypes = appInfo?.get_supported_types() ?? ['application/pdf'];

    const TIFF_CONTENT_TYPE = 'image/tiff';
    if (Image.contentTypes.includes(TIFF_CONTENT_TYPE))
        contentTypes = contentTypes.filter(t => t !== TIFF_CONTENT_TYPE);

    return contentTypes;
};

export const contentTypes = getPaperTypes();
