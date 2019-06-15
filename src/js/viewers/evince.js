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

const {EvinceDocument, EvinceView, Gtk, Sushi} = imports.gi;

const Gettext = imports.gettext.domain('sushi');
const _ = Gettext.gettext;
const Lang = imports.lang;

const Constants = imports.util.constants;
const MimeHandler = imports.ui.mimeHandler;
const Renderer = imports.ui.renderer;
const Utils = imports.ui.utils;

const EvinceRenderer = new Lang.Class({
    Name: 'EvinceRenderer',
    Extends: Gtk.ScrolledWindow,

    _init : function(file, mainWindow) {
        this.parent({ visible: true,
                      min_content_height: Constants.VIEW_MIN,
                      min_content_width: Constants.VIEW_MIN });

        this.moveOnClick = false;
        this.canFullScreen = true;

        this._mainWindow = mainWindow;
        this._file = file;

        this._pdfLoader = new Sushi.PdfLoader();
        this._pdfLoader.connect('notify::document', this._onDocumentLoaded.bind(this));
        this._pdfLoader.uri = file.get_uri();

        this._view = EvinceView.View.new();
        this._view.show();
        this.add(this._view);

        this.connect('destroy', this._onDestroy.bind(this));
    },

    _updatePageLabel : function() {
        let curPage = this._model.get_page();
        let totPages = this._model.document.get_n_pages();

        this._toolbarBack.set_sensitive(curPage > 0);
        this._toolbarForward.set_sensitive(curPage < totPages - 1);

        this._pageLabel.set_text(_("%d of %d").format(curPage + 1, totPages));
    },

    _onDocumentLoaded : function(pdfLoader) {
        this._model = EvinceView.DocumentModel.new_with_document(pdfLoader.document);
        this._model.set_sizing_mode(EvinceView.SizingMode.FIT_WIDTH);
        this._model.set_continuous(true);

        this._model.connect('page-changed', this._updatePageLabel.bind(this));
        this._updatePageLabel();

        this._view.set_model(this._model);
    },

    get resizePolicy() {
        return Renderer.ResizePolicy.MAX_SIZE;
    },

    populateToolbar : function(toolbar) {
        this._toolbarBack = Utils.createToolButton('go-previous-symbolic', () => {
            this._view.previous_page();
        });
        toolbar.add(this._toolbarBack);

        this._pageLabel = new Gtk.Label({ hexpand: true,
                                          margin_start: 10,
                                          margin_end: 10 });
        toolbar.add(this._pageLabel);

        this._toolbarForward = Utils.createToolButton('go-next-symbolic', () => {
            this._view.next_page();
        });
        toolbar.add(this._toolbarForward);

        let separator = new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL });
        toolbar.add(separator);

        let toolbarZoom = Utils.createFullScreenButton(this._mainWindow);
        toolbar.add(toolbarZoom);
    },

    _onDestroy : function() {
        this._pdfLoader = null;
    }
});

let handler = new MimeHandler.MimeHandler();

EvinceDocument.init();
let mimeTypes = Sushi.query_supported_document_types();
handler.registerMimeTypes(mimeTypes, EvinceRenderer);

let officeTypes = [
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/rtf'
];

handler.registerMimeTypes(officeTypes, EvinceRenderer);
