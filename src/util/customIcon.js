/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi authors */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Ported from Nautilus (Files):
// <https://gitlab.gnome.org/GNOME/nautilus/-/blob/5d4a9f37d9efe2b8a3912ab0bb29aa22ac5c6daf/src/nautilus-file.c>

export const METADATA_KEY_CUSTOM_ICON = 'metadata::custom-icon';
export const METADATA_KEY_CUSTOM_ICON_NAME = 'metadata::custom-icon-name';

/**
 * @param {Gio.File} file
 * @param {Gio.FileInfo} fileInfo
 * @returns {Gio.Icon|undefined|null}
 */
export const getCustomIcon = (file, fileInfo) => {
    // Metadata takes precedence; first we look at the custom
    // icon URI, then at the custom icon name.

    const getFromUri = () => {
        const customIconUri = getCustomIconMetadataUri(file, fileInfo);
        if (customIconUri != null)
            return Gio.FileIcon.new(Gio.File.new_for_uri(customIconUri));
        return null;
    };

    const getFromName = () => {
        const customIconName = getCustomIconMetadataName(fileInfo);
        if (customIconName != null)
            return Gio.ThemedIcon.new_with_default_fallbacks(customIconName);
        return null;
    };

    return fileInfo.get_file_type() === Gio.FileType.DIRECTORY
        ? getFromUri() ?? getFromName()
        : null;
};

const isUriRelative = uri => {
    const scheme = GLib.Uri.parse_scheme(uri);
    return scheme == null;
};

const getCustomIconMetadataUri = (file, fileInfo) => {
    const uri = fileInfo.get_attribute_string(METADATA_KEY_CUSTOM_ICON);
    if (uri != null && isUriRelative(uri)) {
        const directoryUri = file.get_uri();
        return GLib.build_filenamev([directoryUri, uri]);
    }
    return uri;
};

const getCustomIconMetadataName = fileInfo => {
    return fileInfo.get_attribute_string(METADATA_KEY_CUSTOM_ICON_NAME);
};
