#include "sushi-pdf-loader.h"
#include <evince-document.h>
#include <evince-view.h>

G_DEFINE_TYPE (SushiPdfLoader, sushi_pdf_loader, G_TYPE_OBJECT);

enum {
  PROP_DOCUMENT = 1,
  PROP_URI
};

struct _SushiPdfLoaderPrivate {
  EvDocument *document;
  gchar *uri;
};

static void
load_job_done (EvJob *job,
               gpointer user_data)
{
  SushiPdfLoader *self = user_data;

  if (ev_job_is_failed (job)) {
    g_print ("Failed to load document: %s", job->error->message);
    g_object_unref (job);

    return;
  }

  self->priv->document = g_object_ref (job->document);
  g_object_unref (job);

  g_object_notify (G_OBJECT (self), "document");
}

static void
start_loading_document (SushiPdfLoader *self)
{
  EvJob *job;

  job = ev_job_load_new (self->priv->uri);
  g_signal_connect (job, "finished",
                    G_CALLBACK (load_job_done), self);

  ev_job_scheduler_push_job (job, EV_JOB_PRIORITY_NONE);
}

static void
sushi_pdf_loader_set_uri (SushiPdfLoader *self,
                          const gchar *uri)
{
  g_clear_object (&self->priv->document);
  g_free (self->priv->uri);

  self->priv->uri = g_strdup (uri);
  start_loading_document (self);
}

static void
sushi_pdf_loader_dispose (GObject *object)
{
  SushiPdfLoader *self = SUSHI_PDF_LOADER (object);

  g_clear_object (&self->priv->document);
  g_free (self->priv->uri);

  G_OBJECT_CLASS (sushi_pdf_loader_parent_class)->dispose (object);
}

static void
sushi_pdf_loader_get_property (GObject *object,
                               guint       prop_id,
                               GValue     *value,
                               GParamSpec *pspec)
{
  SushiPdfLoader *self = SUSHI_PDF_LOADER (object);

  switch (prop_id) {
  case PROP_DOCUMENT:
    g_value_set_object (value, self->priv->document);
    break;
  case PROP_URI:
    g_value_set_string (value, self->priv->uri);
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    break;
  }
}

static void
sushi_pdf_loader_set_property (GObject *object,
                               guint       prop_id,
                               const GValue *value,
                               GParamSpec *pspec)
{
  SushiPdfLoader *self = SUSHI_PDF_LOADER (object);

  switch (prop_id) {
  case PROP_URI:
    sushi_pdf_loader_set_uri (self, g_value_get_string (value));
    break;
  default:
    G_OBJECT_WARN_INVALID_PROPERTY_ID (object, prop_id, pspec);
    break;
  }
}

static void
sushi_pdf_loader_class_init (SushiPdfLoaderClass *klass)
{
  GObjectClass *oclass;

  oclass = G_OBJECT_CLASS (klass);
  oclass->dispose = sushi_pdf_loader_dispose;
  oclass->get_property = sushi_pdf_loader_get_property;
  oclass->set_property = sushi_pdf_loader_set_property;

    g_object_class_install_property
      (oclass,
       PROP_DOCUMENT,
       g_param_spec_object ("document",
                            "Document",
                            "The loaded document",
                            EV_TYPE_DOCUMENT,
                            G_PARAM_READABLE));

    g_object_class_install_property
      (oclass,
       PROP_URI,
       g_param_spec_string ("uri",
                            "URI",
                            "The URI to load",
                            NULL,
                            G_PARAM_READWRITE));

    g_type_class_add_private (klass, sizeof (SushiPdfLoaderPrivate));
}

static void
sushi_pdf_loader_init (SushiPdfLoader *self)
{
  self->priv =
    G_TYPE_INSTANCE_GET_PRIVATE (self,
                                 SUSHI_TYPE_PDF_LOADER,
                                 SushiPdfLoaderPrivate);
}

SushiPdfLoader *
sushi_pdf_loader_new (const gchar *uri)
{
  return g_object_new (SUSHI_TYPE_PDF_LOADER,
                       "uri", uri,
                       NULL);
}

/**
 * sushi_pdf_loader_get_max_page_size:
 * @self:
 * @width: (out):
 * @height: (out):
 *
 */
void
sushi_pdf_loader_get_max_page_size (SushiPdfLoader *self,
                                    gdouble *width,
                                    gdouble *height)
{
  if (self->priv->document == NULL)
    return;

  ev_document_get_max_page_size (self->priv->document, width, height);
}
