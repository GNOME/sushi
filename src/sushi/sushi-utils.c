#include <clutter/clutter.h>

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
