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

#include <gdk/gdkx.h>

/**
 * sushi_create_foreign_window:
 * @xid:
 *
 * Returns: (transfer full): a #GdkWindow
 */
GdkWindow *
sushi_create_foreign_window (guint xid)
{
  GdkWindow *retval;

  retval = gdk_x11_window_foreign_new_for_display (gdk_display_get_default (),
                                                   xid);

  return retval;
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
