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

#include "sushi-font-loader.h"

#include <stdlib.h>
#include <ft2build.h>
#include FT_FREETYPE_H

#include <gio/gio.h>

typedef struct {
  FT_Library library;
  FT_Long face_index;
  GFile *file;

  gchar *face_contents;
  gsize face_length;
} FontLoadJob;

static FontLoadJob *
font_load_job_new (FT_Library library,
                   const gchar *uri,
                   gint face_index,
                   GAsyncReadyCallback callback,
                   gpointer user_data)
{
  FontLoadJob *job = g_slice_new0 (FontLoadJob);

  job->library = library;
  job->face_index = (FT_Long) face_index;
  job->file = g_file_new_for_uri (uri);

  return job;
}

static void
font_load_job_free (FontLoadJob *job)
{
  g_clear_object (&job->file);
  g_free (job->face_contents);

  g_slice_free (FontLoadJob, job);
}

G_DEFINE_AUTOPTR_CLEANUP_FUNC (FontLoadJob, font_load_job_free)

static void
face_data_finalizer (void *object)
{
  FT_Face face = object;
  g_clear_object (&face->generic.data);
}

static FT_Face
create_face_from_contents (FontLoadJob *job,
                           gchar **contents,
                           GError **error)
{
  FT_Error ft_error;
  FT_Face retval;

  ft_error = FT_New_Memory_Face (job->library,
                                 (const FT_Byte *) job->face_contents,
                                 (FT_Long) job->face_length,
                                 job->face_index,
                                 &retval);

  if (ft_error != 0) {
    g_autofree gchar *uri = g_file_get_uri (job->file);
    g_set_error (error, G_IO_ERROR, 0,
                 "Unable to read the font face file '%s'", uri);
    return NULL;
  }

  retval->generic.data = g_object_ref (job->file);
  retval->generic.finalizer = face_data_finalizer;

  *contents = g_steal_pointer (&job->face_contents);
  return retval;
}

static gboolean
font_load_job_do_load (FontLoadJob *job,
                       GError **error)
{
  return g_file_load_contents (job->file, NULL,
                               &job->face_contents, &job->face_length,
                               NULL, error);
}

static void
font_load_job (GTask *task,
	       gpointer source_object,
	       gpointer user_data,
               GCancellable *cancellable)
{
  FontLoadJob *job = user_data;
  g_autoptr(GError) error = NULL;

  font_load_job_do_load (job, &error);

  if (error != NULL)
    g_task_return_error (task, g_steal_pointer (&error));
  else
    g_task_return_boolean (task, TRUE);
}

/**
 * sushi_new_ft_face_from_uri: (skip)
 *
 */
FT_Face
sushi_new_ft_face_from_uri (FT_Library library,
                            const gchar *uri,
                            gint face_index,
                            gchar **contents,
                            GError **error)
{
  g_autoptr(FontLoadJob) job = font_load_job_new (library, uri, face_index, NULL, NULL);
  if (!font_load_job_do_load (job, error))
    return NULL;

  return create_face_from_contents (job, contents, error);
}

/**
 * sushi_new_ft_face_from_uri_async: (skip)
 *
 */
void
sushi_new_ft_face_from_uri_async (FT_Library library,
                                  const gchar *uri,
                                  gint face_index,
                                  GAsyncReadyCallback callback,
                                  gpointer user_data)
{
  FontLoadJob *job = font_load_job_new (library, uri, face_index, callback, user_data);
  g_autoptr(GTask) task = g_task_new (NULL, NULL, callback, user_data);

  g_task_set_task_data (task, job, (GDestroyNotify) font_load_job_free);
  g_task_run_in_thread (task, font_load_job);
}

/**
 * sushi_new_ft_face_from_uri_finish: (skip)
 *
 */
FT_Face
sushi_new_ft_face_from_uri_finish (GAsyncResult *result,
                                   gchar **contents,
                                   GError **error)
{
  FontLoadJob *job;

  if (!g_task_propagate_boolean (G_TASK (result), error))
    return NULL;

  job = g_task_get_task_data (G_TASK (result));

  return create_face_from_contents (job, contents, error);
}

/**
 * sushi_get_font_name: (skip)
 *
 */
gchar *
sushi_get_font_name (FT_Face face,
                     gboolean short_form)
{
  const char *style_name = face->style_name;
  const char *family_name = face->family_name;

  if (family_name == NULL) {
    /* Try to get the basename of the file this was loaded from */
    GFile *file = face->generic.data;
    if (G_IS_FILE (file))
      return g_file_get_basename (file);

    /* Use an empty string as the last fallback */
    return g_strdup ("");
  }

  if (style_name == NULL ||
      (short_form && g_strcmp0 (style_name, "Regular") == 0))
    return g_strdup (family_name);

  return g_strconcat (family_name, ", ", style_name, NULL);
}
