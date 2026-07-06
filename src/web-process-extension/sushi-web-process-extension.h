/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi developers */

#pragma once

#include <glib-object.h>
#include <webkit/webkit-web-process-extension.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_WEB_PROCESS_EXTENSION (sushi_web_process_extension_get_type())

G_DECLARE_FINAL_TYPE (SushiWebProcessExtension, sushi_web_process_extension, SUSHI, WEB_PROCESS_EXTENSION, GObject)

SushiWebProcessExtension *sushi_web_process_extension_get        (void);
void                      sushi_web_process_extension_initialize  (SushiWebProcessExtension   *extension,
                                                                   WebKitWebProcessExtension  *webkit_extension);

G_END_DECLS
