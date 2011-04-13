#include "sushi-cover-art.h"

#include <musicbrainz3/mb_c.h>
#include <gdk-pixbuf/gdk-pixbuf.h>

G_DEFINE_TYPE (SushiCoverArtFetcher, sushi_cover_art_fetcher, G_TYPE_OBJECT);

#define SUSHI_COVER_ART_FETCHER_GET_PRIVATE(obj)\
  (G_TYPE_INSTANCE_GET_PRIVATE ((obj), SUSHI_TYPE_COVER_ART_FETCHER, SushiCoverArtFetcherPrivate))

enum {
  PROP_COVER = 1,
  PROP_TAGLIST,
};

struct _SushiCoverArtFetcherPrivate {
  GdkPixbuf *cover;
  GstTagList *taglist;
};

#define AMAZON_IMAGE_FORMAT "http://images.amazon.com/images/P/%s.01.LZZZZZZZ.jpg"

static void sushi_cover_art_fetcher_set_taglist (SushiCoverArtFetcher *self,
                                                 GstTagList *taglist);

static void
sushi_cover_art_fetcher_dispose (GObject *object)
{
  SushiCoverArtFetcherPrivate *priv = SUSHI_COVER_ART_FETCHER_GET_PRIVATE (object);

  g_clear_object (&priv->cover);

  if (priv->taglist != NULL) {
    gst_tag_list_free (priv->taglist);
    priv->taglist = NULL;
  }

  G_OBJECT_CLASS (sushi_cover_art_fetcher_parent_class)->dispose (object);
}

static void
sushi_cover_art_fetcher_get_property (GObject    *gobject,
                                      guint       prop_id,
                                      GValue     *value,
                                      GParamSpec *pspec)
{
  SushiCoverArtFetcher *self = SUSHI_COVER_ART_FETCHER (gobject);
  SushiCoverArtFetcherPrivate *priv = SUSHI_COVER_ART_FETCHER_GET_PRIVATE (self);

  switch (prop_id) {
  case PROP_COVER:
    g_value_set_object (value, priv->cover);
    break;
  case PROP_TAGLIST:
    g_value_set_boxed (value, priv->taglist);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
    break;
  }
}

static void
sushi_cover_art_fetcher_set_property (GObject    *gobject,
                                      guint       prop_id,
                                      const GValue *value,
                                      GParamSpec *pspec)
{
  SushiCoverArtFetcher *self = SUSHI_COVER_ART_FETCHER (gobject);
  SushiCoverArtFetcherPrivate *priv = SUSHI_COVER_ART_FETCHER_GET_PRIVATE (self);

  switch (prop_id) {
  case PROP_TAGLIST:
    sushi_cover_art_fetcher_set_taglist (self, g_value_get_boxed (value));
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID (gobject, prop_id, pspec);
    break;
  }
}

static void
sushi_cover_art_fetcher_init (SushiCoverArtFetcher *self)
{
  self->priv = SUSHI_COVER_ART_FETCHER_GET_PRIVATE (self);
}

static void
sushi_cover_art_fetcher_class_init (SushiCoverArtFetcherClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);

  gobject_class->get_property = sushi_cover_art_fetcher_get_property;
  gobject_class->set_property = sushi_cover_art_fetcher_set_property;
  gobject_class->dispose = sushi_cover_art_fetcher_dispose;

  g_object_class_install_property
    (gobject_class,
     PROP_COVER,
     g_param_spec_object ("cover",
                          "Cover art",
                          "Cover art for the current attrs",
                          GDK_TYPE_PIXBUF,
                          G_PARAM_READABLE));

  g_object_class_install_property
    (gobject_class,
     PROP_TAGLIST,
     g_param_spec_boxed ("taglist",
                         "Taglist",
                         "Current file tags",
                          GST_TYPE_TAG_LIST,
                          G_PARAM_READWRITE));

  g_type_class_add_private (klass, sizeof (SushiCoverArtFetcherPrivate));
}

static gchar *
sushi_amazon_cover_uri_get_for_track (const gchar *artist,
                                      const gchar *album)
{
  MbQuery query;
  MbReleaseFilter filter;
  MbRelease release;
  MbResultList results;
  gint results_len, idx;
  gchar *retval = NULL;

  query = mb_query_new (NULL, NULL);

  filter = mb_release_filter_new ();
  filter = mb_release_filter_title (filter, album);
  filter = mb_release_filter_artist_name (filter, artist);

  results = mb_query_get_releases (query, filter);
  results_len = mb_result_list_get_size (results);

  for (idx = 0; idx < results_len; idx++) {
    gchar asin[255];

    release = mb_result_list_get_release (results, idx);
    mb_release_get_asin (release, asin, 255);

    if (asin != NULL &&
        asin[0] != '\0') {
      retval = g_strdup_printf (AMAZON_IMAGE_FORMAT, asin);
      break;
    }
  }

  return retval;
}

static void
pixbuf_from_stream_async_cb (GObject *source,
                             GAsyncResult *res,
                             gpointer user_data)
{
  SushiCoverArtFetcher *self = user_data;
  SushiCoverArtFetcherPrivate *priv = SUSHI_COVER_ART_FETCHER_GET_PRIVATE (self);
  GError *error = NULL;
  GdkPixbuf *pix;

  pix = gdk_pixbuf_new_from_stream_finish (res, &error);

  if (error != NULL) {
    g_print ("Unable to fetch Amazon cover art: %s\n", error->message);
    g_error_free (error);
    return;
  }

  priv->cover = pix;
  g_object_notify (G_OBJECT (self), "cover");
}

static void
asin_uri_read_cb (GObject *source,
                  GAsyncResult *res,
                  gpointer user_data)
{
  SushiCoverArtFetcher *self = user_data;
  SushiCoverArtFetcherPrivate *priv = SUSHI_COVER_ART_FETCHER_GET_PRIVATE (self);
  GFileInputStream *stream;
  GError *error = NULL;

  stream = g_file_read_finish (G_FILE (source),
                               res, &error);

  if (error != NULL) {
    g_print ("Unable to fetch Amazon cover art: %s\n", error->message);
    g_error_free (error);
    return;
  }

  gdk_pixbuf_new_from_stream_async (G_INPUT_STREAM (stream), NULL,
                                    pixbuf_from_stream_async_cb, self);

  g_object_unref (stream);
}

static void
try_fetch_from_amazon (SushiCoverArtFetcher *self)
{
  SushiCoverArtFetcherPrivate *priv = SUSHI_COVER_ART_FETCHER_GET_PRIVATE (self);
  gchar *asin;
  gchar *artist = NULL;
  gchar *album = NULL;
  GFile *file;

  gst_tag_list_get_string (priv->taglist,
                           GST_TAG_ARTIST, &artist);
  gst_tag_list_get_string (priv->taglist,
                           GST_TAG_ALBUM, &album);

  if (artist == NULL &&
      album == NULL) {
    /* don't even try */
    return;
  }

  asin = sushi_amazon_cover_uri_get_for_track (artist, album);

  if (asin == NULL) {
    g_free (artist);
    g_free (album);

    return;
  }

  file = g_file_new_for_uri (asin);
  g_file_read_async (file, G_PRIORITY_DEFAULT,
                     NULL, asin_uri_read_cb,
                     self);

  g_object_unref (file);
}

/* code taken from Totem */
static GdkPixbuf *
totem_gst_buffer_to_pixbuf (GstBuffer *buffer)
{
  GdkPixbufLoader *loader;
  GdkPixbuf *pixbuf = NULL;
  GError *err = NULL;

  loader = gdk_pixbuf_loader_new ();

  if (gdk_pixbuf_loader_write (loader, buffer->data, buffer->size, &err) &&
      gdk_pixbuf_loader_close (loader, &err)) {
    pixbuf = gdk_pixbuf_loader_get_pixbuf (loader);
    if (pixbuf)
      g_object_ref (pixbuf);
  } else {
    g_warning ("could not convert tag image to pixbuf: %s", err->message);
    g_error_free (err);
  }

  g_object_unref (loader);
  return pixbuf;
}

static const GValue *
totem_gst_tag_list_get_cover_real (GstTagList *tag_list)
{
  const GValue *cover_value = NULL;
  guint i;

  for (i = 0; ; i++) {
    const GValue *value;
    GstBuffer *buffer;
    GstStructure *caps_struct;
    int type;

    value = gst_tag_list_get_value_index (tag_list,
					  GST_TAG_IMAGE,
					  i);
    if (value == NULL)
      break;

    buffer = gst_value_get_buffer (value);

    caps_struct = gst_caps_get_structure (buffer->caps, 0);
    gst_structure_get_enum (caps_struct,
			    "image-type",
			    GST_TYPE_TAG_IMAGE_TYPE,
			    &type);
    if (type == GST_TAG_IMAGE_TYPE_UNDEFINED) {
      if (cover_value == NULL)
        cover_value = value;
    } else if (type == GST_TAG_IMAGE_TYPE_FRONT_COVER) {
      cover_value = value;
      break;
    }
  }

  return cover_value;
}

GdkPixbuf *
totem_gst_tag_list_get_cover (GstTagList *tag_list)
{
  const GValue *cover_value;

  g_return_val_if_fail (tag_list != NULL, FALSE);

  cover_value = totem_gst_tag_list_get_cover_real (tag_list);
  /* Fallback to preview */
  if (!cover_value) {
    cover_value = gst_tag_list_get_value_index (tag_list,
						GST_TAG_PREVIEW_IMAGE,
						0);
  }

  if (cover_value) {
    GstBuffer *buffer;
    GdkPixbuf *pixbuf;

    buffer = gst_value_get_buffer (cover_value);
    pixbuf = totem_gst_buffer_to_pixbuf (buffer);
    return pixbuf;
  }

  return NULL;
}

/* end of code taken from Totem */

static void
try_fetch_from_tags (SushiCoverArtFetcher *self)
{
  SushiCoverArtFetcherPrivate *priv = SUSHI_COVER_ART_FETCHER_GET_PRIVATE (self);

  if (priv->taglist == NULL)
    return;

  if (priv->cover != NULL)
    g_clear_object (&priv->cover);

  priv->cover = totem_gst_tag_list_get_cover (priv->taglist);

  if (priv->cover != NULL)
    g_object_notify (G_OBJECT (self), "cover");
  else
    try_fetch_from_amazon (self);
}

static void
sushi_cover_art_fetcher_set_taglist (SushiCoverArtFetcher *self,
                                     GstTagList *taglist)
{
  SushiCoverArtFetcherPrivate *priv = SUSHI_COVER_ART_FETCHER_GET_PRIVATE (self);

  g_clear_object (&priv->cover);

  if (priv->taglist != NULL) {
    gst_tag_list_free (priv->taglist);
    priv->taglist = NULL;
  }

  priv->taglist = gst_tag_list_copy (taglist);
  try_fetch_from_tags (self);
}

SushiCoverArtFetcher *
sushi_cover_art_fetcher_new (GstTagList *taglist)
{
  return g_object_new (SUSHI_TYPE_COVER_ART_FETCHER,
                       "taglist", taglist,
                       NULL);
}
