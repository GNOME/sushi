#include "sushi-pdf-loader.h"

#include "sushi-utils.h"
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
  gchar *pdf_path;

  GPid unoconv_pid;
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
load_pdf (SushiPdfLoader *self,
          const gchar *uri)
{
  EvJob *job;

  job = ev_job_load_new (uri);
  g_signal_connect (job, "finished",
                    G_CALLBACK (load_job_done), self);

  ev_job_scheduler_push_job (job, EV_JOB_PRIORITY_NONE);
}

static void
unoconv_child_watch_cb (GPid pid,
                        gint status,
                        gpointer user_data)
{
  SushiPdfLoader *self = user_data;
  GFile *file;
  gchar *uri;

  g_spawn_close_pid (pid);
  self->priv->unoconv_pid = -1;

  file = g_file_new_for_path (self->priv->pdf_path);
  uri = g_file_get_uri (file);
  load_pdf (self, uri);

  g_object_unref (file);
  g_free (uri);
}

static void
load_openoffice (SushiPdfLoader *self)
{
  gchar *doc_path, *pdf_path, *tmp_name, *tmp_path;
  GFile *file;
  gboolean res;
  gchar *cmd;

  gint argc;
  GPid pid;
  gchar **argv = NULL;
  GError *error = NULL;

  file = g_file_new_for_uri (self->priv->uri);
  doc_path = g_file_get_path (file);
  g_object_unref (file);

  tmp_name = g_strdup_printf ("sushi-%d.pdf", getpid ());
  tmp_path = g_build_filename (g_get_user_cache_dir (), "sushi", NULL);
  self->priv->pdf_path = pdf_path =
    g_build_filename (tmp_path, tmp_name, NULL);
  g_mkdir_with_parents (tmp_path, 0700);

  cmd = g_strdup_printf ("unoconv -f pdf -o %s %s", pdf_path, doc_path);

  g_free (doc_path);
  g_free (tmp_name);
  g_free (tmp_path);

  res = g_shell_parse_argv (cmd, &argc, &argv, &error);
  g_free (cmd);

  if (!res) {
    g_warning ("Error while parsing the unoconv command line: %s",
               error->message);
    g_error_free (error);

    return;
  }

  res = g_spawn_async (NULL, argv, NULL,
                       G_SPAWN_DO_NOT_REAP_CHILD |
                       G_SPAWN_SEARCH_PATH,
                       NULL, NULL,
                       &pid, &error);

  g_strfreev (argv);

  if (!res) {
    g_warning ("Error while spawning unoconv: %s",
               error->message);
    g_error_free (error);

    return;
  }

  g_child_watch_add (pid, unoconv_child_watch_cb, self);
  self->priv->unoconv_pid = pid;
}

static gboolean
content_type_is_native (const gchar *content_type)
{
  gchar **native_types;
  gint idx;
  gboolean found = FALSE;

  native_types = sushi_query_supported_document_types ();

  for (idx = 0; native_types[idx] != NULL; idx++) {
    found = g_content_type_is_a (content_type, native_types[idx]);
    if (found)
      break;
  }

  g_strfreev (native_types);

  return found;
}

static void
query_info_ready_cb (GObject *obj,
                     GAsyncResult *res,
                     gpointer user_data)
{
  SushiPdfLoader *self = user_data;
  GError *error = NULL;
  GFileInfo *info;
  const gchar *content_type;

  info = g_file_query_info_finish (G_FILE (obj),
                                   res, &error);

  if (error != NULL) {
    g_warning ("Unable to query the mimetype of %s: %s",
               self->priv->uri, error->message);
    g_error_free (error);

    return;
  }

  content_type = g_file_info_get_content_type (info);
  g_object_unref (info);

  if (content_type_is_native (content_type))
    load_pdf (self, self->priv->uri);
  else
    load_openoffice (self);
}

static void
start_loading_document (SushiPdfLoader *self)
{
  GFile *file;

  file = g_file_new_for_uri (self->priv->uri);
  g_file_query_info_async (file,
                           G_FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE,
                           G_FILE_QUERY_INFO_NONE,
                           G_PRIORITY_DEFAULT,
                           NULL,
                           query_info_ready_cb,
                           self);

  g_object_unref (file);
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

void
sushi_pdf_loader_cleanup_document (SushiPdfLoader *self)
{
  if (self->priv->pdf_path) {
    g_unlink (self->priv->pdf_path);
    g_free (self->priv->pdf_path);
  }

  if (self->priv->unoconv_pid != -1) {
    kill (self->priv->unoconv_pid, SIGKILL);
    self->priv->unoconv_pid = -1;
  }
}

static void
sushi_pdf_loader_dispose (GObject *object)
{
  SushiPdfLoader *self = SUSHI_PDF_LOADER (object);

  sushi_pdf_loader_cleanup_document (self);

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
  self->priv->unoconv_pid = -1;
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
