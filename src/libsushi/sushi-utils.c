#include "sushi-utils.h"

#include <gdk/gdkx.h>

static void
_cairo_round_rectangle (cairo_t *cr,
			gdouble	  x,
			gdouble	  y,
			gdouble	  w,
			gdouble	  h,
			gdouble	  radius)
{
	g_return_if_fail (cr != NULL);

	if (radius < 0.0001)
	{
		cairo_rectangle (cr, x, y, w, h);
		return;
	}

	cairo_move_to (cr, x+radius, y);
	cairo_arc (cr, x+w-radius, y+radius, radius, G_PI * 1.5, G_PI * 2);
	cairo_arc (cr, x+w-radius, y+h-radius, radius, 0, G_PI * 0.5);
	cairo_arc (cr, x+radius,   y+h-radius, radius, G_PI * 0.5, G_PI);
	cairo_arc (cr, x+radius,   y+radius,   radius, G_PI, G_PI * 1.5);
}

static void
rounded_background_allocation_cb (ClutterActor *texture)
{
  cairo_t *cr;
  ClutterActorBox allocation;

  clutter_cairo_texture_clear (CLUTTER_CAIRO_TEXTURE (texture));
  
  clutter_actor_get_allocation_box (texture, &allocation);
  clutter_cairo_texture_set_surface_size (CLUTTER_CAIRO_TEXTURE (texture),
                                          clutter_actor_box_get_width (&allocation),
                                          clutter_actor_box_get_height (&allocation));

  cr = clutter_cairo_texture_create (CLUTTER_CAIRO_TEXTURE (texture));

  _cairo_round_rectangle (cr, allocation.x1, allocation.y1,
                          clutter_actor_box_get_width (&allocation),
                          clutter_actor_box_get_height (&allocation),
                          6.0);
  cairo_set_source_rgb (cr, 0.0, 0.0, 0.0);

  cairo_fill (cr);
  cairo_destroy (cr);
}

/**
 * sushi_create_rounded_background:
 *
 * Returns: (transfer none): a #ClutterActor
 */
ClutterActor *
sushi_create_rounded_background (void)
{
  ClutterActor *retval;

  retval = clutter_cairo_texture_new (1, 1);
  g_signal_connect (retval, "notify::allocation",
                    G_CALLBACK (rounded_background_allocation_cb), NULL);

  return retval;
}

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
