#include <config.h>

#include <stdlib.h>

#include <glib.h>
#include <glib-object.h>

#include <girepository.h>

#include <gjs/gjs.h>

#include <gtk/gtk.h>
#include <clutter/clutter.h>
#include <clutter-gtk/clutter-gtk.h>

static void
parse_options (int *argc, char ***argv)
{
  GOptionContext *ctx;
  GError *error = NULL;

  ctx = g_option_context_new (NULL);

  g_option_context_add_group (ctx, g_irepository_get_option_group ());

  if (!g_option_context_parse (ctx, argc, argv, &error))
    {
      g_print ("nautilus-preview: %s\n", error->message);
      exit(1);
    }

  g_option_context_free (ctx);
}

static void
update_font_options (GtkSettings *settings)
{
  ClutterBackend *backend;
  const cairo_font_options_t *options;
  cairo_antialias_t antialias_mode;
  gint antialias;

  /* Disable text mipmapping; it causes problems on pre-GEM Intel
   * drivers and we should just be rendering text at the right
   * size rather than scaling it. If we do effects where we dynamically
   * zoom labels, then we might want to reconsider. */
  clutter_set_font_flags (clutter_get_font_flags () & ~CLUTTER_FONT_MIPMAPPING);

  backend = clutter_get_default_backend ();
  options = clutter_backend_get_font_options (backend);

  g_object_get (settings,
                "gtk-xft-antialias", &antialias,
                NULL);

  /* We don't want to turn on subpixel anti-aliasing; since Clutter
   * doesn't currently have the code to support ARGB masks,
   * generating them then squashing them back to A8 is pointless. */
  antialias_mode = (antialias < 0 || antialias) ? CAIRO_ANTIALIAS_GRAY
                                                : CAIRO_ANTIALIAS_NONE;

  cairo_font_options_set_antialias ((cairo_font_options_t *) options,
                                    antialias_mode);
}

static void
settings_notify_cb (GtkSettings *settings,
                    GParamSpec  *pspec,
                    gpointer     data)
{
  update_font_options (settings);
}

static void
register_all_viewers (GjsContext *ctx)
{
  GDir *dir;
  const gchar *name;
  gchar *path;
  GError *error = NULL;

  dir = g_dir_open (NAUTILUS_PREVIEW_PKGDATADIR "/js/viewers", 0, &error);

  if (dir == NULL) {
    g_warning ("Can't open module directory: %s\n", error->message);
    g_error_free (error);
    return;
  }
 
  name = g_dir_read_name (dir);

  while (name != NULL) {
    path = g_build_filename (NAUTILUS_PREVIEW_PKGDATADIR "/js/viewers",
                             name);
    if (!gjs_context_eval_file (ctx,
                                path,
                                NULL,
                                &error)) {
      g_warning ("Unable to parse viewer %s: %s", name, error->message);
      g_error_free (error);
    }

    g_free (path);
    name = g_dir_read_name (dir);
  }

  g_dir_close (dir);
}

int
main (int argc, char **argv)
{
  GjsContext *js_context;
  GtkSettings *settings;
  GError *error;

  clutter_x11_set_use_argb_visual (TRUE);
  gtk_clutter_init (&argc, &argv);
  clutter_gst_init (0, NULL);

  parse_options (&argc, &argv);

  js_context = gjs_context_new_with_search_path (NULL);
  settings = gtk_settings_get_default ();

  g_object_connect (settings,
                    "signal::notify::gtk-xft-dpi",
                    G_CALLBACK (settings_notify_cb), NULL,
                    "signal::notify::gtk-xft-antialias",
                    G_CALLBACK (settings_notify_cb), NULL,
                    "signal::notify::gtk-xft-hinting",
                    G_CALLBACK (settings_notify_cb), NULL,
                    "signal::notify::gtk-xft-hintstyle",
                    G_CALLBACK (settings_notify_cb), NULL,
                    NULL);

  update_font_options (settings);

  error = NULL;

  register_all_viewers (js_context);

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
