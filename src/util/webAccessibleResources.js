// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import Sushi from 'gi://Sushi';
import WebKit from 'gi://WebKit';

const WEB_ACCESSIBLE_RESOURCES = new Set([
    'icons/scalable/actions/alert-caution-symbolic.svg',
    'icons/scalable/actions/alert-important-symbolic.svg',
    'icons/scalable/actions/alert-note-symbolic.svg',
    'icons/scalable/actions/alert-tip-symbolic.svg',
    'icons/scalable/actions/alert-warning-symbolic.svg',
]);

const SUSHI_RESOURCE_SCHEME = 'sushi-resource';

/** @param {WebKit.WebContext} context */
export const registerSushiResourceScheme = context => {
    context.register_uri_scheme(SUSHI_RESOURCE_SCHEME, handleRequest);
    context.get_security_manager().register_uri_scheme_as_cors_enabled(SUSHI_RESOURCE_SCHEME);
};

/** @param {WebKit.URISchemeRequest} request */
const handleRequest = request => {
    const path = request.get_path();

    if (!WEB_ACCESSIBLE_RESOURCES.has(path)) {
        request.finish_error(GLib.Error.new_literal(
            Sushi.Error,
            Sushi.Error.OTHER,
            `Invalid ${SUSHI_RESOURCE_SCHEME}:${path} page.`));
        return;
    }

    try {
        request.finish_with_response(createResponseForPath(path));
    }
    catch (error) {
        request.finish_error(toGLibError(error));
    }
};

const toGLibError = error =>
    error instanceof GLib.Error
        ? error
        : GLib.Error.new_literal(
            Sushi.Error,
            Sushi.Error.OTHER,
            error?.message ?? error?.toString() ?? 'Unknown error');

/** @param {string} path */
const createResponseForPath = path => {
    const stream = Gio.resources_open_stream(`/org/gnome/NautilusPreviewer/${path}`, Gio.ResourceLookupFlags.NONE);
    const response = WebKit.URISchemeResponse.new(stream, /* stream_length */ -1);
    const headers = Soup.MessageHeaders.new(Soup.MessageHeadersType.RESPONSE);
    headers.append('Access-Control-Allow-Origin', '*');
    response.set_http_headers(headers);
    return response;
};
