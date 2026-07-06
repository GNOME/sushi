/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi developers */

#include <webkit/webkit-web-process-extension.h>

#include "sushi-web-process-extension.h"

static SushiWebProcessExtension *extension = NULL;

G_MODULE_EXPORT void
webkit_web_process_extension_initialize_with_user_data (
  WebKitWebProcessExtension *webkit_extension,
  GVariant                  *user_data)
{
  extension = sushi_web_process_extension_get ();
  sushi_web_process_extension_initialize (extension, webkit_extension);
}

static void __attribute__((destructor))
sushi_web_process_extension_shutdown (void)
{
  g_clear_object (&extension);
}
