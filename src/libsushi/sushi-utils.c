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

#include "sushi-utils.h"

#include <glib/gstdio.h>
#include <gtk/gtk.h>

#ifdef GDK_WINDOWING_X11
#include <gdk/gdkx.h>
#endif
#ifdef GDK_WINDOWING_WAYLAND
#include <gdk/gdkwayland.h>
#endif

#include "externalwindow.h"

void
sushi_window_set_child_of_external (GtkWindow *window,
                                    const char *handle)
{
  ExternalWindow *external_window;

  gtk_widget_realize (GTK_WIDGET (window));

  external_window = create_external_window_from_handle (handle);
  if (!external_window)
    return;

  external_window_set_parent_of (external_window,
                                 gtk_widget_get_window (GTK_WIDGET (window)));
  g_object_unref (external_window);
}

/**
 * sushi_get_evince_document_from_job:
 * @job:
 * @error:
 *
 * Returns: (transfer none):
 */
EvDocument *
sushi_get_evince_document_from_job (EvJob   *job,
                                    GError **error)
{
  if (job->failed) {
    g_propagate_error (error, job->error);
    return NULL;
  }

  return job->document;
}

/**
 * sushi_query_supported_document_types:
 *
 * Returns: (transfer full):
 */
gchar **
sushi_query_supported_document_types (void)
{
  GList *infos, *l;
  gchar **retval = NULL;
  GPtrArray *array;
  EvTypeInfo *info;
  gint idx;

  infos = ev_backends_manager_get_all_types_info ();

  if (infos == NULL)
    return NULL;

  array = g_ptr_array_new ();

  for (l = infos; l != NULL; l = l->next) {
    info = l->data;

    for (idx = 0; info->mime_types[idx] != NULL; idx++)
      g_ptr_array_add (array, g_strdup (info->mime_types[idx]));
  }

  g_ptr_array_add (array, NULL);
  retval = (gchar **) g_ptr_array_free (array, FALSE);

  return retval;
}

static void load_libreoffice (GTask *task);

typedef struct {
  GFile *file;
  gchar *pdf_path;

  gboolean checked_libreoffice_flatpak;
  gboolean have_libreoffice_flatpak;
  GPid libreoffice_pid;
} TaskData;

static void
task_data_free (TaskData *data)
{
  if (data->pdf_path) {
    g_unlink (data->pdf_path);
    g_free (data->pdf_path);
  }

  if (data->libreoffice_pid != -1) {
    kill (data->libreoffice_pid, SIGKILL);
    data->libreoffice_pid = -1;
  }

  g_clear_object (&data->file);
  g_free (data);
}

static void
libreoffice_missing_ready_cb (GObject *source,
                              GAsyncResult *res,
                              gpointer user_data)
{
  g_autoptr(GTask) task = user_data;
  g_autoptr(GError) error = NULL;

  g_dbus_connection_call_finish (G_DBUS_CONNECTION (source), res, &error);
  if (error != NULL) {
    /* can't install libreoffice with packagekit - nothing else we can do */
    g_task_return_error (task, g_steal_pointer (&error));
    return;
  }

  /* now that we have libreoffice installed, try again loading the document */
  load_libreoffice (task);
}

static void
libreoffice_missing (GTask *task)
{
  GApplication *app = g_application_get_default ();
  GDBusConnection *connection = g_application_get_dbus_connection (app);
  const gchar *libreoffice_path[2];

  libreoffice_path[0] = "/usr/bin/libreoffice";
  libreoffice_path[1] = NULL;

  g_dbus_connection_call (connection,
                          "org.freedesktop.PackageKit",
                          "/org/freedesktop/PackageKit",
                          "org.freedesktop.PackageKit.Modify2",
                          "InstallProvideFiles",
                          g_variant_new ("(^asssa{sv})",
                                         libreoffice_path,
                                         "hide-confirm-deps",
                                         "org.gnome.NautilusPreviewer",
                                         NULL),
                          NULL, G_DBUS_CALL_FLAGS_NONE,
                          G_MAXINT, NULL,
                          libreoffice_missing_ready_cb,
                          g_object_ref (task));
}

static void
libreoffice_child_watch_cb (GPid pid,
                            gint status,
                            gpointer user_data)
{
  g_autoptr(GTask) task = user_data;
  TaskData *data = g_task_get_task_data (task);

  g_spawn_close_pid (pid);
  data->libreoffice_pid = -1;

  g_task_return_pointer (task, g_file_new_for_path (data->pdf_path), g_object_unref);
}

#define LIBREOFFICE_FLATPAK "org.libreoffice.LibreOffice"

static gboolean
check_libreoffice_flatpak (GTask       *task,
                           const gchar *flatpak_path)
{
  const gchar *check_argv[] = { flatpak_path, "info", LIBREOFFICE_FLATPAK, NULL };
  g_autoptr(GError) error = NULL;
  gboolean ret;
  gint exit_status = -1;
  TaskData *data = g_task_get_task_data (task);

  if (data->checked_libreoffice_flatpak)
    return data->have_libreoffice_flatpak;

  data->checked_libreoffice_flatpak = TRUE;

  ret = g_spawn_sync (NULL, (gchar **) check_argv, NULL,
                      G_SPAWN_DEFAULT |
                      G_SPAWN_STDERR_TO_DEV_NULL |
                      G_SPAWN_STDOUT_TO_DEV_NULL,
                      NULL, NULL,
                      NULL, NULL,
                      &exit_status, &error);

  if (ret) {
    g_autoptr(GError) child_error = NULL;
    if (g_spawn_check_exit_status (exit_status, &child_error)) {
      g_debug ("Found LibreOffice flatpak!");
      data->have_libreoffice_flatpak = TRUE;
    } else {
      g_debug ("LibreOffice flatpak not found, flatpak info returned %i (%s)",
               exit_status, child_error->message);
    }
  } else {
    g_warning ("Error while checking for LibreOffice flatpak: %s",
               error->message);
  }

  return data->have_libreoffice_flatpak;
}

static void
load_libreoffice (GTask *task)
{
  g_autofree gchar *flatpak_path = NULL, *libreoffice_path = NULL;
  g_autofree gchar *doc_path = NULL, *doc_name = NULL, *tmp_name = NULL;
  g_autofree gchar *command = NULL, *pdf_dir = NULL;
  g_auto(GStrv) argv = NULL;
  g_autoptr(GError) error = NULL;
  gboolean use_flatpak = FALSE;
  gboolean res;
  GPid pid;
  TaskData *data = g_task_get_task_data (task);

  flatpak_path = g_find_program_in_path ("flatpak");
  if (flatpak_path != NULL)
    use_flatpak = check_libreoffice_flatpak (task, flatpak_path);

  if (!use_flatpak) {
    libreoffice_path = g_find_program_in_path ("libreoffice");
    if (libreoffice_path == NULL) {
      libreoffice_missing (task);
      return;
    }
  }

  doc_path = g_file_get_path (data->file);
  doc_name = g_file_get_basename (data->file);

  /* libreoffice --convert-to replaces the extension with .pdf */
  tmp_name = g_strrstr (doc_name, ".");
  if (tmp_name)
    *tmp_name = '\0';
  tmp_name = g_strdup_printf ("%s.pdf", doc_name);

  pdf_dir = g_build_filename (g_get_user_cache_dir (), "sushi", NULL);
  data->pdf_path = g_build_filename (pdf_dir, tmp_name, NULL);
  g_mkdir_with_parents (pdf_dir, 0700);

  if (use_flatpak) {
    g_autofree gchar *flatpak_doc = g_strdup_printf ("--filesystem=%s:ro", doc_path);
    g_autofree gchar *flatpak_dir = g_strdup_printf ("--filesystem=%s", pdf_dir);

    const gchar *flatpak_argv[] = {
      NULL, /* to be replaced with flatpak binary */
      "run", "--command=/app/libreoffice/program/soffice",
      "--nofilesystem=host",
      NULL, /* to be replaced with filesystem permissions to read document */
      NULL, /* to be replaced with filesystem permissions to write output */
      LIBREOFFICE_FLATPAK,
      "--convert-to", "pdf",
      "--outdir", NULL, /* to be replaced with output dir */
      NULL, /* to be replaced with input file */
      NULL
    };

    flatpak_argv[0] = flatpak_path;
    flatpak_argv[4] = flatpak_doc;
    flatpak_argv[5] = flatpak_dir;
    flatpak_argv[10] = pdf_dir;
    flatpak_argv[11] = doc_path;

    argv = g_strdupv ((gchar **) flatpak_argv);
  } else {
    const gchar *libreoffice_argv[] = {
      NULL, /* to be replaced with binary */
      "--convert-to", "pdf",
      "--outdir", NULL, /* to be replaced with output dir */
      NULL, /* to be replaced with input file */
      NULL
    };

    libreoffice_argv[0] = libreoffice_path;
    libreoffice_argv[4] = pdf_dir;
    libreoffice_argv[5] = doc_path;

    argv = g_strdupv ((gchar **) libreoffice_argv);
  }

  command = g_strjoinv (" ", (gchar **) argv);
  g_debug ("Executing LibreOffice command: %s", command);

  res = g_spawn_async (NULL, (gchar **) argv, NULL,
                       G_SPAWN_DO_NOT_REAP_CHILD,
                       NULL, NULL,
                       &pid, &error);

  if (!res) {
    g_warning ("Error while spawning libreoffice: %s", error->message);
    return;
  }

  g_child_watch_add (pid, libreoffice_child_watch_cb, g_object_ref (task));
  data->libreoffice_pid = pid;
}

void
sushi_convert_libreoffice (GFile *file,
                           GAsyncReadyCallback callback,
                           gpointer user_data)
{
  GTask *task = g_task_new (NULL, NULL, callback, user_data);
  TaskData *data = g_new0 (TaskData, 1);
  data->libreoffice_pid = -1;
  data->file = g_object_ref (file);

  g_task_set_task_data (task, data, (GDestroyNotify) task_data_free);
  load_libreoffice (task);
}

/**
 * sushi_convert_libreoffice_finish:
 * @result:
 * @error:
 *
 * Returns: (transfer full):
 */
GFile *
sushi_convert_libreoffice_finish (GAsyncResult *result,
                                  GError **error)
{
  return g_task_propagate_pointer (G_TASK (result), error);
}

/**
 * sushi_pixbuf_from_gst_sample:
 * @sample:
 * @error:
 *
 * Returns: (transfer full):
 */
GdkPixbuf *
sushi_pixbuf_from_gst_sample (GstSample *sample,
                              GError   **error)
{
  g_autoptr(GdkPixbufLoader) loader = NULL;
  GstBuffer *buffer = gst_sample_get_buffer (sample);
  GdkPixbuf *pixbuf = NULL;
  GstMapInfo info;

  if (!gst_buffer_map (buffer, &info, GST_MAP_READ)) {
    g_set_error_literal (error, G_IO_ERROR, G_IO_ERROR_FAILED,
                         "Failed to map GstBuffer");
    return NULL;
  }

  loader = gdk_pixbuf_loader_new ();
  if (!gdk_pixbuf_loader_write (loader, info.data, info.size, error) ||
      !gdk_pixbuf_loader_close (loader, error))
    return NULL;

  pixbuf = gdk_pixbuf_loader_get_pixbuf (loader);
  if (pixbuf)
    g_object_ref (pixbuf);

  gst_buffer_unmap (buffer, &info);

  return pixbuf;
}

/**
 * sushi_running_under_wayland:
 *
 * Returns: Whether we are running under Wayland backend.
 */
gboolean
sushi_running_under_wayland (GdkDisplay *display)
{
#ifdef GDK_WINDOWING_WAYLAND
  return GDK_IS_WAYLAND_DISPLAY (display);
#endif

  return FALSE;
}
