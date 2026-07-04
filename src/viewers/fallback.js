/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2011 Red Hat, Inc.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 */

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';
import * as Gettext from 'gettext';

import {Renderer,ResizePolicy} from '../core/renderer.js';
import {getCustomIcon} from '../util/customIcon.js';

function _getDeepCountAttrs() {
    return [
        Gio.FILE_ATTRIBUTE_STANDARD_SIZE,
        Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
        Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE,
        Gio.FILE_ATTRIBUTE_STANDARD_NAME,
        Gio.FILE_ATTRIBUTE_UNIX_INODE
    ].join(',');
}

const loadFile = function(_fileToLoad, _fileInfo, _cancellable, _updateCallback) {
    let _seenInodes = new Set();
    let _subDirectories = [];
    let _enumerator = null;
    let _file = null;

    let _state = { file: _fileToLoad,
                   fileInfo: _fileInfo,
                   directoryItems: 0,
                   fileItems: 0,
                   loading: true,
                   totalItems: 0,
                   totalSize: 0,
                   unreadableItems: 0 }
    let _timeoutId = 0;

    function _cleanup() {
        if (_enumerator && !_enumerator.is_closed())
            _enumerator.close_async(0, null, null);
    }

    function _deepCountLoad() {
        _file.enumerate_children_async(
            _getDeepCountAttrs(), Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
            GLib.PRIORITY_LOW, _cancellable,
            (f, res) => {
                try {
                    _enumerator = _file.enumerate_children_finish(res);
                } catch(e) {
                    _state.unreadableItems++;
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        _deepCountNext();
                    return;
                }

                _enumerator.next_files_async(
                    100, GLib.PRIORITY_LOW, _cancellable,
                    _deepCountMoreFiles);
            });
    }

    function _deepCountMoreFiles(en, res) {
        let files = [];
        try {
            files = _enumerator.next_files_finish(res);
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;
        }

        files.forEach(_deepCountOne);

        if (files.length) {
            _enumerator.next_files_async(
                100, GLib.PRIORITY_LOW, _cancellable,
                _deepCountMoreFiles);
        } else {
            _cleanup();
            _deepCountNext();
        }
    }

    function _deepCountNext() {
        _file = _subDirectories.shift();
        if (_file) {
            _deepCountLoad();
        } else {
            _cleanup();
            _state.loading = false;
        }

        _queueUpdate();
    }

    function _deepCountOne(info) {
        let inode = info.get_attribute_uint64(Gio.FILE_ATTRIBUTE_UNIX_INODE);
        let isSeen = false;
        if (inode) {
            isSeen = _seenInodes.has(inode);
            if (!isSeen)
                _seenInodes.add(inode);
        }

        let fileType = info.get_file_type();
        if (fileType == Gio.FileType.DIRECTORY) {
            _state.directoryItems++;
            _subDirectories.unshift(_file.get_child(info.get_name()));
        } else {
            _state.fileItems++;
        }

        if (!isSeen && info.has_attribute(Gio.FILE_ATTRIBUTE_STANDARD_SIZE))
            _state.totalSize += info.get_size();
    }

    function _queueUpdate() {
        if (_timeoutId != 0)
            return;

        _timeoutId = GLib.timeout_add(0, 300, () => {
            _timeoutId = 0;
            _sendUpdate();
            return false;
        });
    }

    function _unqueueUpdate() {
        if (_timeoutId != 0)
            GLib.source_remove(_timeoutId);
    }

    function _sendUpdate() {
        _updateCallback(_state);
    }

    _cancellable.connect(_unqueueUpdate);

    _file = _fileToLoad;
    let fileType = _fileInfo.get_file_type();
    if (fileType == Gio.FileType.DIRECTORY)
        _deepCountLoad();
    else
        _state.loading = false;

    _sendUpdate();
};

export class FallbackRenderer extends Adw.Bin {
    static {
        GObject.registerClass({
            Implements: [Renderer],
            Template: 'resource:///org/gnome/NautilusPreviewer/ui/fallback.ui',
            InternalChildren: ['statusPage', 'spinner', 'sizeLabel', 'dateLabel'],
        }, this);
    }

    constructor(file, fileInfo, constructProperties = {}) {
        super(constructProperties);

        this.cancellable = new Gio.Cancellable();
        loadFile(file, fileInfo, this.cancellable, this._onFileInfoUpdated.bind(this));

        this.isReady();
    }

    _applyLabels(state) {
        let fileName = state.fileInfo.get_display_name();
        this._statusPage.set_title(fileName);

        let contentType = state.fileInfo.get_content_type();
        let typeDescr = Gio.content_type_get_description(contentType);
        this._statusPage.set_description(typeDescr);

        let sizeFormatted;
        if (state.fileInfo.get_file_type() != Gio.FileType.DIRECTORY) {
            sizeFormatted = GLib.format_size(state.fileInfo.get_size());
        } else if (state.totalSize > 0) {
            let itemsStr = Gettext.ngettext(
                "%d item", "%d items",
                state.fileItems + state.directoryItems).
                format(state.fileItems + state.directoryItems);
            sizeFormatted = `${GLib.format_size(state.totalSize)}, ${itemsStr}`;
        } else if (!state.loading) {
            sizeFormatted = _("Empty");
        }

        if (sizeFormatted)
        {
            this._sizeLabel.set_label(sizeFormatted);
        }

        let date = GLib.DateTime.new_from_timeval_local(state.fileInfo.get_modification_time());
        this._dateLabel.set_label(date.format('%x %X'));
    }

    _applyIcon(state) {
        const customIcon = getCustomIcon(state.file, state.fileInfo);
        const icon = customIcon ?? state.fileInfo.get_icon();
        const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        const paintable = iconTheme.lookup_by_gicon(icon, 256, this.scale_factor, 0, 0);
        if (paintable)
            this._statusPage.set_paintable (paintable);
        else
            this._statusPage.set_icon_name('image-missing-symbolic');
    }

    _onFileInfoUpdated(state) {
        if (!state.loading) {
            this._spinner.set_visible(false)
        }

        this._applyIcon(state);
        this._applyLabels(state);
    }

    get resizePolicy() {
        return ResizePolicy.STATUS_PAGE;
    }

    get topBarStyle() {
        return Adw.ToolbarStyle.FLAT;
    }
}
