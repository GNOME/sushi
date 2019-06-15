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

#include <stdlib.h>

#include <glib.h>
#include <glib-object.h>

#include <girepository.h>

#include <gjs/gjs.h>

#include <gst/gst.h>
#include <gtk/gtk.h>

static void
parse_options (int *argc, char ***argv)
{
  GOptionContext *ctx;
  GError *error = NULL;

  ctx = g_option_context_new (NULL);

  g_option_context_add_group (ctx, g_irepository_get_option_group ());

  if (!g_option_context_parse (ctx, argc, argv, &error))
    {
      g_print ("sushi: %s\n", error->message);
      exit(1);
    }

  g_option_context_free (ctx);
}

int
main (int argc, char **argv)
{
  GjsContext *js_context;
  GError *error;

  gst_init (&argc, &argv);
  gtk_init (&argc, &argv);
  parse_options (&argc, &argv);

  js_context = gjs_context_new_with_search_path (NULL);
  error = NULL;

  if (!gjs_context_eval (js_context,
                         "const Main = imports.ui.main;\n"
                         "Main.run();\n",
                         -1,
                         __FILE__,
                         NULL,
                         &error))
    g_error("Failed to load main javascript: %s", error->message);

  return EXIT_SUCCESS;
}
