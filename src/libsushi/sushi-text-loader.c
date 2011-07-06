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
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
 * 02111-1307, USA.
 *
 * The Sushi project hereby grant permission for non-gpl compatible GStreamer
 * plugins to be used and distributed together with GStreamer and Sushi. This
 * permission is above and beyond the permissions granted by the GPL license
 * Sushi is covered by.
 *
 * Authors: Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

#include "sushi-text-loader.h"

#include <gtksourceview/gtksourceview.h>
#include <gtksourceview/gtksourcelanguagemanager.h>

#include <string.h>

#include "sushi-utils.h"

G_DEFINE_TYPE (SushiTextLoader, sushi_text_loader, G_TYPE_OBJECT);

enum {
  PROP_URI = 1,
  NUM_PROPERTIES
};

enum {
  LOADED,
  NUM_SIGNALS
};

static GParamSpec* properties[NUM_PROPERTIES] = { NULL, };
static guint signals[NUM_SIGNALS] = { 0, };

struct _SushiTextLoaderPrivate {
  gchar *uri;

  GtkSourceBuffer *buffer;
};

/* code adapted from gtksourceview:tests/test-widget.c
 * License: LGPL v2.1+
 * Copyright (C) 2001 - Mikael Hermansson <tyan@linux.se>
 * Copyright (C) 2003 - Gustavo Giráldez <gustavo.giraldez@gmx.net>
 */
static GtkSourceLanguage *
get_language_for_file (GtkTextBuffer *buffer,
                       const gchar *filename)
{
  GtkSourceLanguageManager *manager;
  GtkSourceLanguage *language;
  GtkTextIter start, end;
  gchar *text;
  gchar *content_type;
  gboolean result_uncertain;

  gtk_text_buffer_get_start_iter (buffer, &start);

  if (gtk_text_buffer_get_char_count (buffer) < 1024)
    gtk_text_buffer_get_end_iter (buffer, &end);
  else
    gtk_text_buffer_get_iter_at_offset (buffer, &end, 1024);

  text = gtk_text_buffer_get_slice (buffer, &start, &end, TRUE);

  content_type = g_content_type_guess (filename,
                                       (guchar*) text,
                                       strlen (text),
                                       &result_uncertain);
  if (result_uncertain) {
    g_free (content_type);
    content_type = NULL;
  }

  manager = gtk_source_language_manager_get_default ();
  language = gtk_source_language_manager_guess_language (manager,
                                                         filename,
                                                         content_type);

  g_free (content_type);
  g_free (text);

  return language;
}

static GtkSourceLanguage *
get_language_by_id (const gchar *id)
{
  GtkSourceLanguageManager *manager;
  manager = gtk_source_language_manager_get_default ();

  return gtk_source_language_manager_get_language (manager, id);
}

static GtkSourceLanguage *
text_loader_get_buffer_language (SushiTextLoader *self,
                                 GFile *file)
{
  GtkSourceBuffer *buffer = self->priv->buffer;
  GtkSourceLanguage *language = NULL;
  GtkTextIter start, end;
  gchar *text;
  gchar *lang_string;

  gtk_text_buffer_get_start_iter (GTK_TEXT_BUFFER (buffer), &start);
  end = start;
  gtk_text_iter_forward_line (&end);

#define LANG_STRING "gtk-source-lang:"
  text = gtk_text_iter_get_slice (&start, &end);
  lang_string = strstr (text, LANG_STRING);

  if (lang_string != NULL) {
    gchar **tokens;

    lang_string += strlen (LANG_STRING);
    g_strchug (lang_string);

    tokens = g_strsplit_set (lang_string, " \t\n", 2);

    if (tokens != NULL && tokens[0] != NULL)
      language = get_language_by_id (tokens[0]);

    g_strfreev (tokens);
  }

  if (language == NULL) {
    gchar *basename;

    basename = g_file_get_basename (file);
    language = get_language_for_file (GTK_TEXT_BUFFER (buffer), basename);

    g_free (basename);
  }

  g_free (text);

  return language;
}

static void
load_contents_async_ready_cb (GObject *source,
                              GAsyncResult *res,
                              gpointer user_data)
{
  SushiTextLoader *self = user_data;
  GError *error = NULL;
  gchar *contents;
  GtkSourceLanguage *language = NULL;

  g_file_load_contents_finish (G_FILE (source), res,
                               &contents, NULL, NULL,
                               &error);

  if (error != NULL) {
    /* FIXME: we need to report the error */
    g_print ("Can't load the text file: %s\n", error->message);
    g_error_free (error);

    return;
  }

  gtk_source_buffer_begin_not_undoable_action (self->priv->buffer);
  gtk_text_buffer_set_text (GTK_TEXT_BUFFER (self->priv->buffer), contents, -1);
  gtk_source_buffer_end_not_undoable_action (self->priv->buffer);

  language = text_loader_get_buffer_language (self, G_FILE (source));
  gtk_source_buffer_set_language (self->priv->buffer, language);

  g_signal_emit (self, signals[LOADED], 0, self->priv->buffer);

  g_free (contents);
}

static void
start_loading_buffer (SushiTextLoader *self)
{
  GFile *file;

  self->priv->buffer = gtk_source_buffer_new (NULL);

  file = g_file_new_for_uri (self->priv->uri);
  g_file_load_contents_async (file, NULL,
                              load_contents_async_ready_cb,
                              self);

  g_object_unref (file);
}

static void
sushi_text_loader_set_uri (SushiTextLoader *self,
                          const gchar *uri)
{
  if (g_strcmp0 (uri, self->priv->uri) != 0) {
    g_free (self->priv->uri);

    self->priv->uri = g_strdup (uri);
    g_clear_object (&self->priv->buffer);

    start_loading_buffer (self);

    g_object_notify_by_pspec (G_OBJECT (self), properties[PROP_URI]);
  }
}

static void
sushi_text_loader_dispose (GObject *object)
{
  SushiTextLoader *self = SUSHI_TEXT_LOADER (object);

  g_free (self->priv->uri);

  G_OBJECT_CLASS (sushi_text_loader_parent_class)->dispose (object);
}

static void
sushi_text_loader_get_property (GObject *object,
                               guint       prop_id,
                               GValue     *value,
                               GParamSpec *pspec)
{
  SushiTextLoader *self = SUSHI_TEXT_LOADER (object);

  switch (prop_id) {
  case PROP_URI:
    g_value_set_string (value, self->priv->uri);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    break;
  }
}

static void
sushi_text_loader_set_property (GObject *object,
                               guint       prop_id,
                               const GValue *value,
                               GParamSpec *pspec)
{
  SushiTextLoader *self = SUSHI_TEXT_LOADER (object);

  switch (prop_id) {
  case PROP_URI:
    sushi_text_loader_set_uri (self, g_value_get_string (value));
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    break;
  }
}

static void
sushi_text_loader_class_init (SushiTextLoaderClass *klass)
{
  GObjectClass *oclass;

  oclass = G_OBJECT_CLASS (klass);
  oclass->dispose = sushi_text_loader_dispose;
  oclass->get_property = sushi_text_loader_get_property;
  oclass->set_property = sushi_text_loader_set_property;

  properties[PROP_URI] =
    g_param_spec_string ("uri",
                         "URI",
                         "The URI to load",
                         NULL,
                         G_PARAM_READWRITE);

  signals[LOADED] =
    g_signal_new ("loaded",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_FIRST,
                  0, NULL, NULL,
                  g_cclosure_marshal_VOID__OBJECT,
                  G_TYPE_NONE,
                  1, GTK_SOURCE_TYPE_BUFFER);

  g_object_class_install_properties (oclass, NUM_PROPERTIES, properties);

  g_type_class_add_private (klass, sizeof (SushiTextLoaderPrivate));
}

static void
sushi_text_loader_init (SushiTextLoader *self)
{
  self->priv =
    G_TYPE_INSTANCE_GET_PRIVATE (self,
                                 SUSHI_TYPE_TEXT_LOADER,
                                 SushiTextLoaderPrivate);
}

SushiTextLoader *
sushi_text_loader_new (const gchar *uri)
{
  return g_object_new (SUSHI_TYPE_TEXT_LOADER,
                       "uri", uri,
                       NULL);
}
