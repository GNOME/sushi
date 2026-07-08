// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

#pragma once

#include <glib.h>
#include "sd-dlopen.h"

G_BEGIN_DECLS

gboolean   sushi_markdown_available ();
GBytes *   sushi_markdown_to_html (GBytes *markdown, GError **error);

#define SUSHI_MARKDOWN_ERROR sushi_markdown_error_quark ()
G_DEFINE_QUARK (sushi-markdown-error-quark, sushi_markdown_error)

typedef enum SushiMarkdownError
{
  SUSHI_MARKDOWN_ERROR_UNAVAILABLE,
} SushiMarkdownError;

G_END_DECLS

#define SUSHI_MD4C_HTML_SO "libmd4c-html.so.0"

SD_ELF_NOTE_DLOPEN("markdown", "Markdown support",
                   SD_ELF_NOTE_DLOPEN_PRIORITY_RECOMMENDED,
                   SUSHI_MD4C_HTML_SO);
