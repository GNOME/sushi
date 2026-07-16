/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GObject from 'gi://GObject';
import PapersDocument from 'gi://PapersDocument';
import PapersView from 'gi://PapersView';
import Sushi from 'gi://Sushi';
// eslint-disable-next-line no-restricted-properties
const Format = imports.format;

import {Renderer} from '../core/renderer.js';
import {ToolbarOverlay} from '../widgets/toolbarOverlay.js';

import * as Libreoffice from './libreoffice.js';

export const Klass = class PdfRenderer extends ToolbarOverlay {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/pdf.ui',
            InternalChildren: [
                'model', 'view', 'toolbarBack', 'toolbarForward', 'pageLabel',
            ],
        }, this);
    }

    constructor(file, fileInfo, constructProperties = {}) {
        GObject.type_ensure(PapersView.View);

        super(constructProperties);

        if (papersTypes.includes(fileInfo.get_content_type())) {
            this._loadFile(file);
        } else {
            Sushi.convert_libreoffice(file, this.getCancellable(), (o, res) => {
                let convertedFile;
                try {
                    convertedFile = Sushi.convert_libreoffice_finish(res);
                } catch (e) {
                    this.emit('error', e);
                    return;
                }

                this._loadFile(convertedFile);
            });
        }

        this._defineActions();

        this.isReady();
    }

    stop() {
        this._job?.cancel();
        this._job = null;
    }

    cleanup() {
        this.cleanupOverlay();
    }

    _loadFile(file) {
        this._job = PapersView.JobLoad.new();
        this._job.set_uri(file.get_uri());

        const cancellable = this.getCancellable();
        const loadJobID = this._job.connect_object(
            'finished',
            job => {
                if (cancellable.is_cancelled())
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
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                this.emit('error', e);
            return;
        }

        this._model.set_document(document);
        this._model.set_sizing_mode(PapersView.SizingMode.FIT_WIDTH);
        this._model.set_continuous(true);

        this._model.connect_object(
            'page-changed',
            () => this._updatePageLabel(this._model),
            this, GObject.ConnectFlags.DEFAULT
        );
        this._updatePageLabel(this._model);
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

PapersDocument.init();
const appInfo = GioUnix.DesktopAppInfo.new('org.gnome.Papers.desktop');
const papersTypes = appInfo.get_supported_types();
export const mimeTypes = Libreoffice.isAvailable()
    ? papersTypes
    : [...papersTypes, ...Libreoffice.officeTypes];
