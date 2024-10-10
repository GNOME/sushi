/*
 * Copyright (C) 2011 Red Hat, Inc.
 * Copyright (C) 2014 Khaled Hosny <khaledhosny@eglug.org>.
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

#include "sushi-font-widget.h"
#include "sushi-font-loader.h"

#include <hb-glib.h>
#include <math.h>

enum {
  PROP_URI = 1,
  PROP_FACE_INDEX,
  NUM_PROPERTIES
};

enum {
  LOADED,
  ERROR,
  NUM_SIGNALS
};

struct _SushiFontWidget {
  GtkDrawingArea parent_instance;

  gchar *uri;
  gint face_index;

  FT_Library library;
  FT_Face face;
  gchar *face_contents;

  const gchar *lowercase_text;
  const gchar *uppercase_text;
  const gchar *punctuation_text;

  gchar *sample_string;

  gchar *font_name;
};

static GParamSpec *properties[NUM_PROPERTIES] = { NULL, };
static guint signals[NUM_SIGNALS] = { 0, };

G_DEFINE_TYPE (SushiFontWidget, sushi_font_widget, GTK_TYPE_DRAWING_AREA)

#define SURFACE_SIZE 4
#define SECTION_SPACING 16
#define LINE_SPACING 2

static const gchar lowercase_text_stock[] = "abcdefghijklmnopqrstuvwxyz";
static const gchar uppercase_text_stock[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
static const gchar punctuation_text_stock[] = "0123456789.:,;(*!?')";

static void
text_to_glyphs (cairo_t *cr,
                const gchar *text,
                cairo_glyph_t **glyphs,
                int *num_glyphs)
{
  PangoAttribute *fallback_attr;
  PangoAttrList *attr_list;
  PangoContext *context;
  PangoDirection base_dir;
  GList *items;
  GList *visual_items;
  FT_Face ft_face;
  hb_font_t *hb_font;
  gdouble x = 0, y = 0;
  gint i;
  gdouble x_scale, y_scale;

  *num_glyphs = 0;
  *glyphs = NULL;

  base_dir = pango_find_base_dir (text, -1);

  cairo_scaled_font_t *cr_font = cairo_get_scaled_font (cr);
  ft_face = cairo_ft_scaled_font_lock_face (cr_font);
  hb_font = hb_ft_font_create (ft_face, NULL);

  cairo_surface_t *target = cairo_get_target (cr);
  cairo_surface_get_device_scale (target, &x_scale, &y_scale);

  /* We abuse pango itemazation to split text into script and direction
   * runs, since we use our fonts directly no through pango, we don't
   * bother changing the default font, but we disable font fallback as
   * pango will split runs at font change */
  context = pango_cairo_create_context (cr);
  attr_list = pango_attr_list_new ();
  fallback_attr = pango_attr_fallback_new (FALSE);
  pango_attr_list_insert (attr_list, fallback_attr);
  items = pango_itemize_with_base_dir (context, base_dir,
                                       text, 0, strlen (text),
                                       attr_list, NULL);
  g_object_unref (context);
  pango_attr_list_unref (attr_list);

  /* reorder the items in the visual order */
  visual_items = pango_reorder_items (items);

  while (visual_items) {
    PangoItem *item;
    PangoAnalysis analysis;
    hb_buffer_t *hb_buffer;
    hb_glyph_info_t *hb_glyphs;
    hb_glyph_position_t *hb_positions;
    gint n;

    item = visual_items->data;
    analysis = item->analysis;

    hb_buffer = hb_buffer_create ();
    hb_buffer_add_utf8 (hb_buffer, text, -1, item->offset, item->length);
    hb_buffer_set_script (hb_buffer, hb_glib_script_to_script (analysis.script));
    hb_buffer_set_language (hb_buffer, hb_language_from_string (pango_language_to_string (analysis.language), -1));
    hb_buffer_set_direction (hb_buffer, analysis.level % 2 ? HB_DIRECTION_RTL : HB_DIRECTION_LTR);

    hb_shape (hb_font, hb_buffer, NULL, 0);

    n = hb_buffer_get_length (hb_buffer);
    hb_glyphs = hb_buffer_get_glyph_infos (hb_buffer, NULL);
    hb_positions = hb_buffer_get_glyph_positions (hb_buffer, NULL);

    *glyphs = g_renew (cairo_glyph_t, *glyphs, *num_glyphs + n);

    for (i = 0; i < n; i++) {
      (*glyphs)[*num_glyphs + i].index = hb_glyphs[i].codepoint;
      (*glyphs)[*num_glyphs + i].x = x + (hb_positions[i].x_offset / (64. * x_scale));
      (*glyphs)[*num_glyphs + i].y = y - (hb_positions[i].y_offset / (64. * y_scale));
      x += (hb_positions[i].x_advance / (64. * x_scale));
      y -= (hb_positions[i].y_advance / (64. * y_scale));
    }

    *num_glyphs += n;

    hb_buffer_destroy (hb_buffer);

    visual_items = visual_items->next;
  }

  g_list_free_full (visual_items, (GDestroyNotify) pango_item_free);
  g_list_free_full (items, (GDestroyNotify) pango_item_free);

  hb_font_destroy (hb_font);
  cairo_ft_scaled_font_unlock_face (cr_font);
}

static void
text_extents (cairo_t *cr,
              const char *text,
              cairo_text_extents_t *extents)
{
  g_autofree cairo_glyph_t *glyphs = NULL;
  gint num_glyphs;

  text_to_glyphs (cr, text, &glyphs, &num_glyphs);
  cairo_glyph_extents (cr, glyphs, num_glyphs, extents);
}

/* adapted from gnome-utils:font-viewer/font-view.c
 *
 * Copyright (C) 2002-2003  James Henstridge <james@daa.com.au>
 * Copyright (C) 2010 Cosimo Cecchi <cosimoc@gnome.org>
 *
 * License: GPLv2+
 */
static void
draw_string (SushiFontWidget *self,
             cairo_t *cr,
             GtkBorder padding,
	     const gchar *text,
	     gint *pos_y)
{
  g_autofree cairo_glyph_t *glyphs = NULL;
  cairo_font_extents_t font_extents;
  cairo_text_extents_t extents;
  GtkTextDirection text_dir;
  gint pos_x;
  gint num_glyphs;
  gint i;

  text_dir = gtk_widget_get_direction (GTK_WIDGET (self));

  text_to_glyphs (cr, text, &glyphs, &num_glyphs);

  cairo_font_extents (cr, &font_extents);
  cairo_glyph_extents (cr, glyphs, num_glyphs, &extents);

  if (pos_y != NULL)
    *pos_y += font_extents.ascent + font_extents.descent +
      extents.y_advance + LINE_SPACING / 2;
  if (text_dir == GTK_TEXT_DIR_LTR)
    pos_x = padding.left;
  else {
    pos_x = gtk_widget_get_allocated_width (GTK_WIDGET (self)) -
      extents.x_advance - padding.right;
  }

  for (i = 0; i < num_glyphs; i++) {
    glyphs[i].x += pos_x;
    glyphs[i].y += *pos_y;
  }

  cairo_move_to (cr, pos_x, *pos_y);
  cairo_show_glyphs (cr, glyphs, num_glyphs);

  *pos_y += LINE_SPACING / 2;
}

static gboolean
check_font_contain_text (FT_Face face,
                         const gchar *text)
{
  g_autofree gunichar *string = NULL;
  glong len, idx;

  string = g_utf8_to_ucs4_fast (text, -1, &len);
  for (idx = 0; idx < len; idx++) {
    gunichar c = string[idx];

    if (!FT_Get_Char_Index (face, c))
      return FALSE;
  }

  return TRUE;
}

static gchar *
build_charlist_for_face (FT_Face face,
                         gint *length)
{
  g_autoptr(GString) string = NULL;
  gulong c;
  guint glyph;
  gint total_chars = 0;

  string = g_string_new (NULL);

  c = FT_Get_First_Char (face, &glyph);

  while (glyph != 0) {
    g_string_append_unichar (string, (gunichar) c);
    c = FT_Get_Next_Char (face, c, &glyph);
    total_chars++;
  }

  if (length)
    *length = total_chars;

  return g_strdup (string->str);
}

static gchar *
random_string_from_available_chars (FT_Face face,
                                    gint n_chars)
{
  g_autofree gchar *chars = NULL;
  g_autoptr(GString) retval = NULL;
  gint idx, rand, total_chars;
  gchar *ptr, *end;

  idx = 0;
  chars = build_charlist_for_face (face, &total_chars);

  if (total_chars == 0)
    return NULL;

  if (total_chars <= n_chars)
    return g_steal_pointer (&chars);

  retval = g_string_new (NULL);

  while (idx < n_chars) {
    rand = g_random_int_range (0, total_chars);

    ptr = g_utf8_offset_to_pointer (chars, rand);
    end = g_utf8_find_next_char (ptr, NULL);

    g_string_append_len (retval, ptr, end - ptr);
    idx++;
  }

  return g_strdup (retval->str);
}

static gboolean
set_pango_sample_string (SushiFontWidget *self)
{
  const gchar *sample_string;
  gboolean retval = FALSE;

  sample_string = pango_language_get_sample_string (pango_language_from_string (NULL));
  if (check_font_contain_text (self->face, sample_string))
    retval = TRUE;

  if (!retval) {
    sample_string = pango_language_get_sample_string (pango_language_from_string ("C"));
    if (check_font_contain_text (self->face, sample_string))
      retval = TRUE;
  }

  g_clear_pointer (&self->sample_string, g_free);

  if (retval)
    self->sample_string = g_strdup (sample_string);

  return retval;
}

static void
select_best_charmap (SushiFontWidget *self)
{
  gchar *chars;
  gint idx, n_chars;

  if (FT_Select_Charmap (self->face, FT_ENCODING_UNICODE) == 0)
    return;

  for (idx = 0; idx < self->face->num_charmaps; idx++) {
    if (FT_Set_Charmap (self->face, self->face->charmaps[idx]) != 0)
      continue;

    chars = build_charlist_for_face (self->face, &n_chars);
    g_free (chars);

    if (n_chars > 0)
      break;
  }
}

static void
build_strings_for_face (SushiFontWidget *self)
{
  select_best_charmap (self);

  /* if we don't have lowercase/uppercase/punctuation text in the face,
   * we omit it directly, and render a random text below.
   */
  if (check_font_contain_text (self->face, lowercase_text_stock))
    self->lowercase_text = lowercase_text_stock;
  else
    self->lowercase_text = NULL;

  if (check_font_contain_text (self->face, uppercase_text_stock))
    self->uppercase_text = uppercase_text_stock;
  else
    self->uppercase_text = NULL;

  if (check_font_contain_text (self->face, punctuation_text_stock))
    self->punctuation_text = punctuation_text_stock;
  else
    self->punctuation_text = NULL;

  if (!set_pango_sample_string (self))
    self->sample_string = random_string_from_available_chars (self->face, 36);

  g_free (self->font_name);
  self->font_name = sushi_get_font_name (self->face, FALSE);
}

static gint *
build_sizes_table (FT_Face face,
		   gint *n_sizes,
		   gint *alpha_size,
                   gint *title_size)
{
  gint *sizes = NULL;
  gint i;

  /* work out what sizes to render */
  if (FT_IS_SCALABLE (face)) {
    *n_sizes = 14;
    sizes = g_new (gint, *n_sizes);
    sizes[0] = 8;
    sizes[1] = 10;
    sizes[2] = 12;
    sizes[3] = 18;
    sizes[4] = 24;
    sizes[5] = 36;
    sizes[6] = 48;
    sizes[7] = 72;
    sizes[8] = 96;
    sizes[9] = 120;
    sizes[10] = 144;
    sizes[11] = 168;
    sizes[12] = 192;
    sizes[13] = 216;

    *alpha_size = 24;
    *title_size = 48;
  } else {
    gint alpha_diff = G_MAXINT;
    gint title_diff = G_MAXINT;

    /* use fixed sizes */
    *n_sizes = face->num_fixed_sizes;
    sizes = g_new (gint, *n_sizes);
    *alpha_size = 0;

    for (i = 0; i < face->num_fixed_sizes; i++) {
      sizes[i] = face->available_sizes[i].height;

      if ((gint) (abs (sizes[i] - 24)) < alpha_diff) {
        alpha_diff = (gint) abs (sizes[i] - 24);
        *alpha_size = sizes[i];
      }
      if ((gint) (abs (sizes[i] - 24)) < title_diff) {
        title_diff = (gint) abs (sizes[i] - 24);
        *title_size = sizes[i];
      }
    }
  }

  return sizes;
}

static void
sushi_font_widget_size_request (GtkWidget *drawing_area,
                                gint *width,
                                gint *height,
                                gint *min_height)
{
  SushiFontWidget *self = SUSHI_FONT_WIDGET (drawing_area);
  gint i, pixmap_width, pixmap_height;
  cairo_text_extents_t extents;
  cairo_font_extents_t font_extents;
  cairo_font_face_t *font;
  g_autofree gint *sizes = NULL;
  gint n_sizes, alpha_size, title_size;
  cairo_t *cr;
  cairo_surface_t *surface;
  FT_Face face = self->face;
  GtkStyleContext *context;
  GtkStateFlags state;
  GtkBorder padding;

  if (face == NULL) {
    if (width != NULL)
      *width = 1;
    if (height != NULL)
      *height = 1;
    if (min_height != NULL)
      *min_height = 1;

    return;
  }

  if (min_height != NULL)
    *min_height = -1;

  surface = cairo_image_surface_create (CAIRO_FORMAT_ARGB32,
                                        SURFACE_SIZE, SURFACE_SIZE);
  cr = cairo_create (surface);
  context = gtk_widget_get_style_context (drawing_area);
  state = gtk_style_context_get_state (context);
  gtk_style_context_get_padding (context, state, &padding);

  sizes = build_sizes_table (face, &n_sizes, &alpha_size, &title_size);

  /* calculate size of pixmap to use */
  pixmap_width = padding.left + padding.right;
  pixmap_height = padding.top + padding.bottom;

  font = cairo_ft_font_face_create_for_ft_face (face, 0);

  if (check_font_contain_text (face, self->font_name))
    cairo_set_font_face (cr, font);
  else
    cairo_set_font_face (cr, NULL);

  cairo_set_font_size (cr, title_size);
  cairo_font_extents (cr, &font_extents);
  text_extents (cr, self->font_name, &extents);
  pixmap_height += font_extents.ascent + font_extents.descent +
    extents.y_advance + LINE_SPACING;
  pixmap_width = MAX (pixmap_width, extents.width + padding.left + padding.right);

  pixmap_height += SECTION_SPACING / 2;

  cairo_set_font_face (cr, font);
  cairo_set_font_size (cr, alpha_size);
  cairo_font_extents (cr, &font_extents);

  if (self->lowercase_text != NULL) {
    text_extents (cr, self->lowercase_text, &extents);
    pixmap_height += font_extents.ascent + font_extents.descent + 
      extents.y_advance + LINE_SPACING;
    pixmap_width = MAX (pixmap_width, extents.width + padding.left + padding.right);
  }

  if (self->uppercase_text != NULL) {
    text_extents (cr, self->uppercase_text, &extents);
    pixmap_height += font_extents.ascent + font_extents.descent +
      extents.y_advance + LINE_SPACING;
    pixmap_width = MAX (pixmap_width, extents.width + padding.left + padding.right);
  }

  if (self->punctuation_text != NULL) {
    text_extents (cr, self->punctuation_text, &extents);
    pixmap_height += font_extents.ascent + font_extents.descent +
      extents.y_advance + LINE_SPACING;
    pixmap_width = MAX (pixmap_width, extents.width + padding.left + padding.right);
  }

  if (self->sample_string != NULL) {
    pixmap_height += SECTION_SPACING;

    for (i = 0; i < n_sizes; i++) {
      cairo_set_font_size (cr, sizes[i]);
      cairo_font_extents (cr, &font_extents);
      text_extents (cr, self->sample_string, &extents);
      pixmap_height += font_extents.ascent + font_extents.descent +
        extents.y_advance + LINE_SPACING;
      pixmap_width = MAX (pixmap_width, extents.width + padding.left + padding.right);

      if ((i == 7) && (min_height != NULL))
        *min_height = pixmap_height;
    }
  }

  pixmap_height += padding.bottom + SECTION_SPACING;

  if (min_height != NULL && *min_height == -1)
    *min_height = pixmap_height;

  if (width != NULL)
    *width = pixmap_width;

  if (height != NULL)
    *height = pixmap_height;

  cairo_destroy (cr);
  cairo_font_face_destroy (font);
  cairo_surface_destroy (surface);
}

static void
sushi_font_widget_measure (GtkWidget      *drawing_area,
                           GtkOrientation  orientation,
                           int             for_size,
                           int            *min,
                           int            *nat,
                           int            *min_baseline,
                           int            *nat_baseline)
{
  gint width;
  gint height;
  gint min_height;

  sushi_font_widget_size_request (drawing_area, &width, &height, &min_height);
  if (orientation == GTK_ORIENTATION_HORIZONTAL)
  {
    *min = 0;
    *nat = width;
  }
  else
  {
    *min = min_height;
    *nat = height;
  }
}

static gboolean
sushi_font_widget_draw (GtkWidget *drawing_area,
                        cairo_t *cr)
{
  SushiFontWidget *self = SUSHI_FONT_WIDGET (drawing_area);
  g_autofree gint *sizes = NULL;
  gint n_sizes, alpha_size, title_size, pos_y = 0, i;
  cairo_font_face_t *font = NULL;
  FT_Face face = self->face;
  GtkStyleContext *context;
  GdkRGBA color;
  GtkBorder padding;
  GtkStateFlags state;
  gint allocated_width, allocated_height;

  if (face == NULL)
    return FALSE;

  context = gtk_widget_get_style_context (drawing_area);
  state = gtk_style_context_get_state (context);

  allocated_width = gtk_widget_get_allocated_width (drawing_area);
  allocated_height = gtk_widget_get_allocated_height (drawing_area);

  gtk_render_background (context, cr,
                         0, 0, allocated_width, allocated_height);

  gtk_style_context_get_color (context, state, &color);
  gtk_style_context_get_padding (context, state, &padding);

  gdk_cairo_set_source_rgba (cr, &color);

  sizes = build_sizes_table (face, &n_sizes, &alpha_size, &title_size);

  font = cairo_ft_font_face_create_for_ft_face (face, 0);

  /* draw text */
  if (check_font_contain_text (face, self->font_name))
    cairo_set_font_face (cr, font);
  else
    cairo_set_font_face (cr, NULL);

  cairo_set_font_size (cr, title_size);
  draw_string (self, cr, padding, self->font_name, &pos_y);

  if (pos_y > allocated_height)
    goto end;

  pos_y += SECTION_SPACING / 2;
  cairo_set_font_face (cr, font);
  cairo_set_font_size (cr, alpha_size);

  if (self->lowercase_text != NULL)
    draw_string (self, cr, padding, self->lowercase_text, &pos_y);
  if (pos_y > allocated_height)
    goto end;

  if (self->uppercase_text != NULL)
    draw_string (self, cr, padding, self->uppercase_text, &pos_y);
  if (pos_y > allocated_height)
    goto end;

  if (self->punctuation_text != NULL)
    draw_string (self, cr, padding, self->punctuation_text, &pos_y);
  if (pos_y > allocated_height)
    goto end;

  pos_y += SECTION_SPACING;

  for (i = 0; i < n_sizes; i++) {
    cairo_set_font_size (cr, sizes[i]);
    if (self->sample_string !=  NULL)
      draw_string (self, cr, padding, self->sample_string, &pos_y);
    if (pos_y > allocated_height)
      break;
  }

 end:
  cairo_font_face_destroy (font);

  return FALSE;
}

static void
font_face_async_ready_cb (GObject *object,
                          GAsyncResult *result,
                          gpointer user_data)
{
  SushiFontWidget *self = user_data;
  g_autoptr(GError) error = NULL;

  self->face =
    sushi_new_ft_face_from_uri_finish (result,
                                       &self->face_contents,
                                       &error);

  if (error != NULL) {
    g_signal_emit (self, signals[ERROR], 0, error);
    g_print ("Can't load the font face: %s\n", error->message);

    return;
  }

  build_strings_for_face (self);

  gtk_widget_queue_resize (GTK_WIDGET (self));
  g_signal_emit (self, signals[LOADED], 0);
}

void
sushi_font_widget_load (SushiFontWidget *self)
{
  sushi_new_ft_face_from_uri_async (self->library,
                                    self->uri,
                                    self->face_index,
                                    font_face_async_ready_cb,
                                    self);
}

static void
sushi_font_widget_init (SushiFontWidget *self)
{
  FT_Error err = FT_Init_FreeType (&self->library);

  if (err != FT_Err_Ok)
    g_error ("Unable to initialize FreeType");

  gtk_style_context_add_class (gtk_widget_get_style_context (GTK_WIDGET (self)),
                               GTK_STYLE_CLASS_VIEW);
}

static void
sushi_font_widget_get_property (GObject *object,
                                guint       prop_id,
                                GValue     *value,
                                GParamSpec *pspec)
{
  SushiFontWidget *self = SUSHI_FONT_WIDGET (object);

  switch (prop_id) {
  case PROP_URI:
    g_value_set_string (value, self->uri);
    break;
  case PROP_FACE_INDEX:
    g_value_set_int (value, self->face_index);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    break;
  }
}

static void
sushi_font_widget_set_property (GObject *object,
                               guint       prop_id,
                               const GValue *value,
                               GParamSpec *pspec)
{
  SushiFontWidget *self = SUSHI_FONT_WIDGET (object);

  switch (prop_id) {
  case PROP_URI:
    self->uri = g_value_dup_string (value);
    break;
  case PROP_FACE_INDEX:
    self->face_index = g_value_get_int (value);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    break;
  }
}

static void
sushi_font_widget_finalize (GObject *object)
{
  SushiFontWidget *self = SUSHI_FONT_WIDGET (object);

  g_free (self->uri);

  if (self->face != NULL) {
    FT_Done_Face (self->face);
    self->face = NULL;
  }

  g_free (self->font_name);
  g_free (self->sample_string);
  g_free (self->face_contents);

  if (self->library != NULL) {
    FT_Done_FreeType (self->library);
    self->library = NULL;
  }

  G_OBJECT_CLASS (sushi_font_widget_parent_class)->finalize (object);
}

static void
sushi_font_widget_constructed (GObject *object)
{
  SushiFontWidget *self = SUSHI_FONT_WIDGET (object);

  sushi_font_widget_load (self);

  G_OBJECT_CLASS (sushi_font_widget_parent_class)->constructed (object);
}

static void
sushi_font_widget_class_init (SushiFontWidgetClass *klass)
{
  GObjectClass *oclass = G_OBJECT_CLASS (klass);
  GtkWidgetClass *wclass = GTK_WIDGET_CLASS (klass);

  oclass->finalize = sushi_font_widget_finalize;
  oclass->set_property = sushi_font_widget_set_property;
  oclass->get_property = sushi_font_widget_get_property;
  oclass->constructed = sushi_font_widget_constructed;

  wclass->draw = sushi_font_widget_draw;
  wclass->measure = sushi_font_widget_measure;

  properties[PROP_URI] =
    g_param_spec_string ("uri",
                         "Uri", "Uri",
                         NULL, G_PARAM_READWRITE | G_PARAM_CONSTRUCT);
  properties[PROP_FACE_INDEX] =
    g_param_spec_int ("face-index",
                      "Face index", "Face index",
                      0, G_MAXINT,
                      0, G_PARAM_READWRITE | G_PARAM_CONSTRUCT);

  signals[LOADED] =
    g_signal_new ("loaded",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_FIRST,
                  0, NULL, NULL,
                  g_cclosure_marshal_VOID__VOID,
                  G_TYPE_NONE, 0);
  signals[ERROR] =
    g_signal_new ("error",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_FIRST,
                  0, NULL, NULL,
                  g_cclosure_marshal_VOID__STRING,
                  G_TYPE_NONE, 1, G_TYPE_ERROR);

  g_object_class_install_properties (oclass, NUM_PROPERTIES, properties);
}

SushiFontWidget *
sushi_font_widget_new (const gchar *uri, gint face_index)
{
  return g_object_new (SUSHI_TYPE_FONT_WIDGET,
                       "uri", uri,
                       "face-index", face_index,
                       NULL);
}

/**
 * sushi_font_widget_get_ft_face: (skip)
 *
 */
FT_Face
sushi_font_widget_get_ft_face (SushiFontWidget *self)
{
  return self->face;
}

const gchar *
sushi_font_widget_get_uri (SushiFontWidget *self)
{
  return self->uri;
}
