#ifndef __SUSHI_COVER_ART_H__
#define __SUSHI_COVER_ART_H__

#include <glib-object.h>
#include <gst/tag/tag.h>

G_BEGIN_DECLS

#define SUSHI_TYPE_COVER_ART_FETCHER            (sushi_cover_art_fetcher_get_type ())
#define SUSHI_COVER_ART_FETCHER(obj)            (G_TYPE_CHECK_INSTANCE_CAST ((obj), SUSHI_TYPE_COVER_ART_FETCHER, SushiCoverArtFetcher))
#define SUSHI_IS_COVER_ART_FETCHER(obj)         (G_TYPE_CHECK_INSTANCE_TYPE ((obj), SUSHI_TYPE_COVER_ART_FETCHER))
#define SUSHI_COVER_ART_FETCHER_CLASS(klass)    (G_TYPE_CHECK_CLASS_CAST ((klass),  SUSHI_TYPE_COVER_ART_FETCHER, SushiCoverArtFetcherClass))
#define SUSHI_IS_COVER_ART_FETCHER_CLASS(klass) (G_TYPE_CHECK_CLASS_TYPE ((klass),  SUSHI_TYPE_COVER_ART_FETCHER))
#define SUSHI_COVER_ART_FETCHER_GET_CLASS(obj)  (G_TYPE_INSTANCE_GET_CLASS ((obj),  SUSHI_TYPE_COVER_ART_FETCHER, SushiCoverArtFetcherClass))

typedef struct _SushiCoverArtFetcher          SushiCoverArtFetcher;
typedef struct _SushiCoverArtFetcherPrivate   SushiCoverArtFetcherPrivate;
typedef struct _SushiCoverArtFetcherClass     SushiCoverArtFetcherClass;

struct _SushiCoverArtFetcher
{
  GObject parent_instance;

  SushiCoverArtFetcherPrivate *priv;
};

struct _SushiCoverArtFetcherClass
{
  GObjectClass parent_class;
};

GType    sushi_cover_art_fetcher_get_type     (void) G_GNUC_CONST;
SushiCoverArtFetcher* sushi_cover_art_fetcher_new (GstTagList *taglist);

G_END_DECLS

#endif /* __SUSHI_COVER_ART_H__ */
