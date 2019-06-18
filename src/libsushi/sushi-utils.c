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

/**
 * sushi_create_foreign_window:
 * @xid:
 *
 * Returns: (transfer full): a #GdkWindow
 */
GdkWindow *
sushi_create_foreign_window (guint xid)
{
  GdkWindow *retval = NULL;

#ifdef GDK_WINDOWING_X11
  if (GDK_IS_X11_DISPLAY (gdk_display_get_default ()))
    retval = gdk_x11_window_foreign_new_for_display (gdk_display_get_default (), xid);
#endif

  return retval;
}

/**
 * sushi_get_evince_document_from_job:
 * @job:
 *
 * Returns: (transfer none):
 */
EvDocument *
sushi_get_evince_document_from_job (EvJob *job)
{
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
  GTask *task = user_data;
  GError *error = NULL;

  g_dbus_connection_call_finish (G_DBUS_CONNECTION (source), res, &error);
  if (error != NULL) {
    /* can't install libreoffice with packagekit - nothing else we can do */
    g_task_return_error (task, error);
    g_object_unref (task);
    return;
  }

  /* now that we have libreoffice installed, try again loading the document */
  load_libreoffice (task);
}

static void
libreoffice_missing (GTask *task)
{
  GApplication *app = g_application_get_default ();
  GtkWidget *widget = GTK_WIDGET (gtk_application_get_active_window (GTK_APPLICATION (app)));
  GDBusConnection *connection = g_application_get_dbus_connection (app);
  guint xid = 0;
  GdkWindow *gdk_window;
  const gchar *libreoffice_path[2];

  gdk_window = gtk_widget_get_window (widget);
  if (gdk_window != NULL)
    xid = GDK_WINDOW_XID (gdk_window);

  libreoffice_path[0] = "/usr/bin/libreoffice";
  libreoffice_path[1] = NULL;

  g_dbus_connection_call (connection,
                          "org.freedesktop.PackageKit",
                          "/org/freedesktop/PackageKit",
                          "org.freedesktop.PackageKit.Modify",
                          "InstallProvideFiles",
                          g_variant_new ("(u^ass)",
                                         xid,
                                         libreoffice_path,
                                         "hide-confirm-deps"),
                          NULL, G_DBUS_CALL_FLAGS_NONE,
                          G_MAXINT, NULL,
                          libreoffice_missing_ready_cb,
                          task);
}

static void
libreoffice_child_watch_cb (GPid pid,
                            gint status,
                            gpointer user_data)
{
  GTask *task = user_data;
  TaskData *data = g_task_get_task_data (task);
  GFile *file;

  g_spawn_close_pid (pid);
  data->libreoffice_pid = -1;

  file = g_file_new_for_path (data->pdf_path);
  g_task_return_pointer (task, file, g_object_unref);
  g_object_unref (task);
}

#define LIBREOFFICE_FLATPAK "org.libreoffice.LibreOffice"

static gboolean
check_libreoffice_flatpak (GTask       *task,
                           const gchar *flatpak_path)
{
  const gchar *check_argv[] = { flatpak_path, "info", LIBREOFFICE_FLATPAK, NULL };
  gboolean ret;
  gint exit_status = -1;
  GError *error = NULL;
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
    GError *child_error = NULL;
    if (g_spawn_check_exit_status (exit_status, &child_error)) {
      g_debug ("Found LibreOffice flatpak!");
      data->have_libreoffice_flatpak = TRUE;
    } else {
      g_debug ("LibreOffice flatpak not found, flatpak info returned %i (%s)",
               exit_status, child_error->message);
      g_clear_error (&child_error);
    }
  } else {
    g_warning ("Error while checking for LibreOffice flatpak: %s",
               error->message);
    g_clear_error (&error);
  }

  return data->have_libreoffice_flatpak;
}

static void
load_libreoffice (GTask *task)
{
  gchar *flatpak_path, *libreoffice_path = NULL;
  gboolean use_flatpak = FALSE;
  gchar *doc_path, *doc_name, *tmp_name, *pdf_dir;
  gchar *flatpak_doc = NULL, *flatpak_dir = NULL;
  gboolean res;
  GPid pid;
  GError *error = NULL;
  gchar **argv = NULL;
  TaskData *data = g_task_get_task_data (task);

  flatpak_path = g_find_program_in_path ("flatpak");
  if (flatpak_path != NULL)
    use_flatpak = check_libreoffice_flatpak (task, flatpak_path);

  if (!use_flatpak) {
    libreoffice_path = g_find_program_in_path ("libreoffice");
    if (libreoffice_path == NULL) {
      libreoffice_missing (task);
      g_free (flatpak_path);
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
  g_free (doc_name);

  pdf_dir = g_build_filename (g_get_user_cache_dir (), "sushi", NULL);
  data->pdf_path = g_build_filename (pdf_dir, tmp_name, NULL);
  g_mkdir_with_parents (pdf_dir, 0700);

  g_free (tmp_name);

  if (use_flatpak) {
    flatpak_doc = g_strdup_printf ("--filesystem=%s:ro", doc_path);
    flatpak_dir = g_strdup_printf ("--filesystem=%s", pdf_dir);

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

  tmp_name = g_strjoinv (" ", (gchar **) argv);
  g_debug ("Executing LibreOffice command: %s", tmp_name);
  g_free (tmp_name);

  res = g_spawn_async (NULL, (gchar **) argv, NULL,
                       G_SPAWN_DO_NOT_REAP_CHILD,
                       NULL, NULL,
                       &pid, &error);

  g_free (pdf_dir);
  g_free (doc_path);
  g_free (libreoffice_path);
  g_free (flatpak_path);
  g_free (flatpak_doc);
  g_free (flatpak_dir);
  g_strfreev (argv);

  if (!res) {
    g_warning ("Error while spawning libreoffice: %s",
               error->message);
    g_error_free (error);

    return;
  }

  g_child_watch_add (pid, libreoffice_child_watch_cb, task);
  data->libreoffice_pid = pid;
}

void
sushi_convert_libreoffice (GFile *file,
                           GAsyncReadyCallback callback,
                           gpointer user_data)
{
  GTask *task = g_task_new (NULL, NULL, callback, user_data);
  TaskData *data = g_new0 (TaskData, 1);
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
