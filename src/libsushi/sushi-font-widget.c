#include "sushi-font-widget.h"
#include "sushi-font-loader.h"

#include <cairo/cairo-ft.h>
#include <math.h>

enum {
  PROP_URI = 1,
  NUM_PROPERTIES
};

enum {
  LOADED,
  NUM_SIGNALS
};

struct _SushiFontWidgetPrivate {
  gchar *uri;

  FT_Face face;
  gchar *face_contents;
};

static GParamSpec *properties[NUM_PROPERTIES] = { NULL, };
static guint signals[NUM_SIGNALS] = { 0, };

G_DEFINE_TYPE (SushiFontWidget, sushi_font_widget, GTK_TYPE_DRAWING_AREA);

#define SECTION_SPACING 16

static const gchar lowercase_text[] = "abcdefghijklmnopqrstuvwxyz";
static const gchar uppercase_text[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
static const gchar punctuation_text[] = "0123456789.:,;(*!?')";

/* adapted from gnome-utils:font-viewer/font-view.c */
static void
draw_string (cairo_t *cr,
             GtkBorder padding,
	     const gchar *text,
	     gint *pos_y)
{
  cairo_text_extents_t extents;
  gdouble cur_x, cur_y;

  cairo_text_extents (cr, text, &extents);

  if (pos_y != NULL)
    *pos_y += extents.height + extents.y_advance + padding.top;

  cairo_move_to (cr, padding.left, *pos_y);
  cairo_show_text (cr, text);

  *pos_y += padding.bottom;
}

static gboolean
check_font_contain_text (FT_Face face, const gchar *text)
{
  while (text && *text) {
    gunichar wc = g_utf8_get_char (text);

    if (!FT_Get_Char_Index (face, wc))
      return FALSE;

    text = g_utf8_next_char (text);
  }

  return TRUE;
}

static const gchar *
get_sample_string (FT_Face face)
{
  const gchar *text;

  text = pango_language_get_sample_string (NULL);

  if (!check_font_contain_text (face, text)) {
    text = pango_language_get_sample_string (pango_language_from_string ("en_US"));
  }

  return text;
}

static gint *
build_sizes_table (FT_Face face,
		   gint *n_sizes,
		   gint *alpha_size)
{
  gint *sizes = NULL;
  gint i;

  /* work out what sizes to render */
  if (FT_IS_SCALABLE (face)) {
    *n_sizes = 8;
    sizes = g_new (gint, *n_sizes);
    sizes[0] = 8;
    sizes[1] = 10;
    sizes[2] = 12;
    sizes[3] = 18;
    sizes[4] = 24;
    sizes[5] = 36;
    sizes[6] = 48;
    sizes[7] = 72;
    *alpha_size = 24;
  } else {
    /* use fixed sizes */
    *n_sizes = face->num_fixed_sizes;
    sizes = g_new (gint, *n_sizes);
    *alpha_size = 0;

    for (i = 0; i < face->num_fixed_sizes; i++) {
      sizes[i] = face->available_sizes[i].height;

      /* work out which font size to render */
      if (face->available_sizes[i].height <= 24)
        *alpha_size = face->available_sizes[i].height;
    }
  }

  return sizes;
}

static void
sushi_font_widget_size_request (GtkWidget *drawing_area,
                                gint *width,
                                gint *height)
{
  SushiFontWidgetPrivate *priv = SUSHI_FONT_WIDGET (drawing_area)->priv;
  gint i, pixmap_width, pixmap_height;
  const gchar *text;
  gchar *font_name;
  cairo_text_extents_t extents;
  cairo_font_face_t *font;
  gint *sizes = NULL, n_sizes, alpha_size;
  cairo_t *cr;
  FT_Face face = priv->face;
  GtkStyleContext *context;
  GtkStateFlags state;
  GtkBorder padding;

  if (face == NULL) {
    if (width != NULL)
      *width = 1;
    if (height != NULL)
      *height = 1;

    return;
  }

  cr = gdk_cairo_create (gtk_widget_get_window (drawing_area));
  context = gtk_widget_get_style_context (drawing_area);
  state = gtk_style_context_get_state (context);
  gtk_style_context_get_padding (context, state, &padding);

  text = get_sample_string (face);
  sizes = build_sizes_table (face, &n_sizes, &alpha_size);

  /* calculate size of pixmap to use */
  pixmap_width = padding.left + padding.right;
  pixmap_height = 0;

  font = cairo_ft_font_face_create_for_ft_face (face, 0);
  cairo_set_font_face (cr, font);
  cairo_set_font_size (cr, alpha_size + 6);
  cairo_font_face_destroy (font);

  font_name =  g_strconcat (face->family_name, " ",
                            face->style_name, NULL);

  cairo_text_extents (cr, font_name, &extents);
  pixmap_height += extents.height + extents.y_advance + padding.top + padding.bottom;
  pixmap_width = MAX (pixmap_width, extents.width + padding.left + padding.right);

  g_free (font_name);

  pixmap_height += SECTION_SPACING / 2;

  cairo_set_font_size (cr, alpha_size);
  cairo_text_extents (cr, lowercase_text, &extents);
  pixmap_height += extents.height + extents.y_advance + padding.top + padding.bottom;
  pixmap_width = MAX (pixmap_width, extents.width + padding.left + padding.right);

  cairo_text_extents (cr, uppercase_text, &extents);
  pixmap_height += extents.height + extents.y_advance + padding.top + padding.bottom;
  pixmap_width = MAX (pixmap_width, extents.width + padding.left + padding.right);

  cairo_text_extents (cr, punctuation_text, &extents);
  pixmap_height += extents.height + extents.y_advance + padding.top + padding.bottom;
  pixmap_width = MAX (pixmap_width, extents.width + padding.left + padding.right);

  pixmap_height += SECTION_SPACING;

  for (i = 0; i < n_sizes; i++) {
    cairo_set_font_size (cr, sizes[i]);
    cairo_text_extents (cr, text, &extents);
    pixmap_height += extents.height + extents.y_advance + padding.top + padding.bottom;
    pixmap_width = MAX (pixmap_width, extents.width + padding.left + padding.right);
  }

  pixmap_height += padding.bottom + SECTION_SPACING;

  if (width != NULL)
    *width = pixmap_width;

  if (height != NULL)
    *height = pixmap_height;

  cairo_destroy (cr);
  g_free (sizes);
}

static void
sushi_font_widget_get_preferred_width (GtkWidget *drawing_area,
                                       gint *minimum_width,
                                       gint *natural_width)
{
  gint width;

  sushi_font_widget_size_request (drawing_area, &width, NULL);

  *minimum_width = *natural_width = width;
}

static void
sushi_font_widget_get_preferred_height (GtkWidget *drawing_area,
                                        gint *minimum_height,
                                        gint *natural_height)
{
  gint height;

  sushi_font_widget_size_request (drawing_area, NULL, &height);

  *minimum_height = *natural_height = height;
}

static gboolean
sushi_font_widget_draw (GtkWidget *drawing_area,
                        cairo_t *cr)
{
  SushiFontWidgetPrivate *priv = SUSHI_FONT_WIDGET (drawing_area)->priv;
  gint *sizes = NULL, n_sizes, alpha_size, pos_y = 0, i;
  const gchar *text;
  cairo_font_face_t *font;
  FT_Face face = priv->face;
  gboolean res;
  GtkStyleContext *context;
  GdkRGBA color;
  GtkBorder padding;
  GtkStateFlags state;
  gint max_x = 0;
  gchar *font_name;

  if (face == NULL)
    goto end;

  context = gtk_widget_get_style_context (drawing_area);
  state = gtk_style_context_get_state (context);
  gtk_style_context_get_color (context, state, &color);
  gtk_style_context_get_padding (context, state, &padding);

  gdk_cairo_set_source_rgba (cr, &color);

  sizes = build_sizes_table (face, &n_sizes, &alpha_size);

  font = cairo_ft_font_face_create_for_ft_face (face, 0);
  cairo_set_font_face (cr, font);
  cairo_font_face_destroy (font);

  font_name =  g_strconcat (face->family_name, " ",
                            face->style_name, NULL);

  /* draw text */
  cairo_set_font_size (cr, alpha_size + 6);
  draw_string (cr, padding, font_name, &pos_y);

  pos_y += SECTION_SPACING / 2;

  cairo_set_font_size (cr, alpha_size);
  draw_string (cr, padding, lowercase_text, &pos_y);
  draw_string (cr, padding, uppercase_text, &pos_y);
  draw_string (cr, padding, punctuation_text, &pos_y);

  pos_y += SECTION_SPACING;

  text = get_sample_string (face);
  for (i = 0; i < n_sizes; i++) {
    cairo_set_font_size (cr, sizes[i]);
    draw_string (cr, padding, text, &pos_y);
  }

 end:
  g_free (sizes);

  return FALSE;
}

static void
font_face_async_ready_cb (GObject *object,
                          GAsyncResult *res,
                          gpointer user_data)
{
  SushiFontWidget *self = user_data;
  FT_Face font_face;
  gchar *contents = NULL;
  GError *error = NULL;

  self->priv->face = sushi_new_ft_face_from_uri_finish (res,
                                                        &self->priv->face_contents,
                                                        &error);

  if (error != NULL) {
    /* FIXME: need to signal the error */
    g_print ("Can't load the font face: %s\n", error->message);
    return;
  }

  gtk_widget_queue_resize (GTK_WIDGET (self));
  g_signal_emit (self, signals[LOADED], 0);
}

static void
load_font_face (SushiFontWidget *self)
{
  sushi_new_ft_face_from_uri_async (self->priv->uri,
                                    font_face_async_ready_cb,
                                    self);
}

static void
sushi_font_widget_set_uri (SushiFontWidget *self,
                           const gchar *uri)
{
  g_free (self->priv->uri);
  self->priv->uri = g_strdup (uri);

  load_font_face (self);
}

static void
sushi_font_widget_init (SushiFontWidget *self)
{
  self->priv = G_TYPE_INSTANCE_GET_PRIVATE (self, SUSHI_TYPE_FONT_WIDGET,
                                            SushiFontWidgetPrivate);

  self->priv->face = NULL;
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
    g_value_set_string (value, self->priv->uri);
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
    sushi_font_widget_set_uri (self, g_value_get_string (value));
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

  g_free (self->priv->uri);

  G_OBJECT_CLASS (sushi_font_widget_parent_class)->finalize (object);
}

static void
sushi_font_widget_class_init (SushiFontWidgetClass *klass)
{
  GObjectClass *oclass = G_OBJECT_CLASS (klass);
  GtkWidgetClass *wclass = GTK_WIDGET_CLASS (klass);

  oclass->finalize = sushi_font_widget_finalize;
  oclass->set_property = sushi_font_widget_set_property;
  oclass->get_property = sushi_font_widget_get_property;

  wclass->draw = sushi_font_widget_draw;
  wclass->get_preferred_width = sushi_font_widget_get_preferred_width;
  wclass->get_preferred_height = sushi_font_widget_get_preferred_height;

  properties[PROP_URI] =
    g_param_spec_string ("uri",
                         "Uri", "Uri",
                         NULL, G_PARAM_READWRITE);

  signals[LOADED] =
    g_signal_new ("loaded",
                  G_TYPE_FROM_CLASS (klass),
                  G_SIGNAL_RUN_FIRST,
                  0, NULL, NULL,
                  g_cclosure_marshal_VOID__VOID,
                  G_TYPE_NONE, 0);

  g_object_class_install_properties (oclass, NUM_PROPERTIES, properties);
  g_type_class_add_private (klass, sizeof (SushiFontWidgetPrivate));
}

SushiFontWidget *
sushi_font_widget_new (const gchar *uri)
{
  return g_object_new (SUSHI_TYPE_FONT_WIDGET,
                       "uri", uri,
                       NULL);
}
