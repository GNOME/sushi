// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

#include "sushi-markdown.h"

#include <dlfcn.h>

// Definitions from <md4c.h>
typedef char MD_CHAR;
typedef unsigned MD_SIZE;
typedef unsigned MD_OFFSET;
#define MD_FLAG_TABLES         0x100   /* Enable tables extension. */
#define MD_FLAG_STRIKETHROUGH  0x200   /* Enable strikethrough extension. */
#define MD_FLAG_TASKLISTS      0x800   /* Enable task list extension. */
typedef int (*MdHtmlFunc) (const MD_CHAR* input, MD_SIZE input_size,
                           void (*process_output)(const MD_CHAR*, MD_SIZE, void*),
                           void* userdata, unsigned parser_flags,
                           unsigned renderer_flags);

static MdHtmlFunc sushi_load_md4c_html (GError **error);

gboolean
sushi_markdown_available ()
{
  GError *error = NULL;
  (void) sushi_load_md4c_html (&error);
  if (error != NULL) {
    g_error_free (error);
    return FALSE;
  } else {
    return TRUE;
  }
}

static void sushi_markdown_to_html_process_output_callback (const MD_CHAR *data,
                                                            MD_SIZE size,
                                                            void *user_data);

GBytes *
sushi_markdown_to_html (GBytes *markdown, GError **error)
{
    static guint8 prelude[] = "<!doctype html><html><head><meta charset=utf-8></head><body>";
    static guint8 postlude[] = "</body></html>";

    GError *md_html_error = NULL;
    MdHtmlFunc md_html = sushi_load_md4c_html(&md_html_error);
    if (md_html_error != NULL) {
      g_propagate_error (error, md_html_error);
      return NULL;
    }

    GByteArray *html = g_byte_array_new();

    int parser_flags = MD_FLAG_TABLES | MD_FLAG_STRIKETHROUGH | MD_FLAG_TASKLISTS;
    int render_flags = 0;

    g_byte_array_append (html, prelude, sizeof(prelude));
    (*md_html) (g_bytes_get_data (markdown, NULL),
                g_bytes_get_size (markdown),
                sushi_markdown_to_html_process_output_callback,
                html,
                parser_flags,
                render_flags);
    g_byte_array_append (html, prelude, sizeof(postlude));

    return g_byte_array_free_to_bytes (html);
}

void
sushi_markdown_to_html_process_output_callback (const MD_CHAR *data, MD_SIZE size, void *user_data)
{
  GByteArray *html = user_data;
  g_byte_array_append (html, (const guint8 *)data, size);
}

MdHtmlFunc
sushi_load_md4c_html (GError **error)
{
  void *handle;
  char *error_msg;
  MdHtmlFunc md_html;

  (void) dlerror (); // clear any existing errors
  handle = dlopen (SUSHI_MD4C_HTML_SO, RTLD_NOW | RTLD_NODELETE);
  error_msg = dlerror ();

  if (error_msg != NULL) {
    g_set_error (error,
                 SUSHI_MARKDOWN_ERROR,
                 SUSHI_MARKDOWN_ERROR_UNAVAILABLE,
                 "Failed to load md4c-html: %s",
                 error_msg);
    return NULL;
  }

  *(void**)(&md_html) = (MdHtmlFunc) dlsym (handle, "md_html");
  error_msg = dlerror ();
  if (error_msg != NULL || md_html == NULL) {
    g_set_error (error,
                 SUSHI_MARKDOWN_ERROR,
                 SUSHI_MARKDOWN_ERROR_UNAVAILABLE,
                 "Failed to locate 'md_html' symbol: %s",
                 error_msg);
    return NULL;
  }

  return md_html;
}
