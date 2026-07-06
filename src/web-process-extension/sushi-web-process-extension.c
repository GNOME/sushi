/* SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
 * SPDX-FileCopyrightText: 2026 The Sushi developers */

#include "sushi-web-process-extension.h"

struct _SushiWebProcessExtension {
  GObject parent_instance;

  WebKitWebProcessExtension *extension;
  gboolean initialized;
  GCancellable *cancellable;

  gboolean should_fetch_remote_resources;
  gboolean has_remote_resources;
};

G_DEFINE_FINAL_TYPE (SushiWebProcessExtension, sushi_web_process_extension, G_TYPE_OBJECT)

static gboolean
sushi_web_process_extension_is_local_request (WebKitURIRequest         *request)
{
  const gchar *scheme = g_uri_peek_scheme (webkit_uri_request_get_uri (request));
  return g_strcmp0(scheme, "file") == 0 ||
         g_strcmp0(scheme, "blob") == 0 ||
         g_strcmp0(scheme, "data") == 0;
}

static void
sushi_web_process_extension_send_has_remote_resources_message (SushiWebProcessExtension *extension)
{
  if (extension->has_remote_resources)
    return;
  extension->has_remote_resources = TRUE;

  WebKitUserMessage *message = webkit_user_message_new ("Sushi.PageHasRemoteResources", NULL);

  webkit_web_process_extension_send_message_to_context (extension->extension,
                                                        message,
                                                        extension->cancellable,
                                                        NULL /* callback */,
                                                        NULL /* user_data */);
}

static gboolean
sushi_web_process_extension_send_request_callback (SushiWebProcessExtension *extension,
                                                   WebKitURIRequest         *request,
                                                   WebKitURIResponse        *redirected_response,
                                                   WebKitWebPage            *web_page)
{
  if (sushi_web_process_extension_is_local_request(request) ||
      extension->should_fetch_remote_resources)
    return FALSE; // propagate to default handler i.e. allowing the request.

  sushi_web_process_extension_send_has_remote_resources_message (extension);

  // cancel the request
  return TRUE;
}

static void
sushi_web_process_extension_page_created_callback (SushiWebProcessExtension *extension,
                                                   WebKitWebPage            *web_page)
{
  g_signal_connect_swapped (web_page, "send-request",
                            G_CALLBACK (sushi_web_process_extension_send_request_callback),
                            extension);
}

static void
sushi_web_process_extension_user_message_received_callback (SushiWebProcessExtension *extension,
                                                            WebKitUserMessage* message,
                                                            WebKitWebProcessExtension* webkit_extension)
{
  const char *name = webkit_user_message_get_name (message);
  if (g_strcmp0 (name, "Sushi.EnableFetchRemoteResources") == 0)
    extension->should_fetch_remote_resources = TRUE;
}

static void
sushi_web_process_extension_dispose (GObject *object)
{
  SushiWebProcessExtension *extension = SUSHI_WEB_PROCESS_EXTENSION (object);

  if (extension->cancellable) {
    g_cancellable_cancel (extension->cancellable);
    g_clear_object (&extension->cancellable);
  }

  g_clear_object (&extension->extension);

  G_OBJECT_CLASS (sushi_web_process_extension_parent_class)->dispose (object);
}

static void
sushi_web_process_extension_class_init (SushiWebProcessExtensionClass *klass)
{
  GObjectClass *object_class = G_OBJECT_CLASS (klass);

  object_class->dispose = sushi_web_process_extension_dispose;
}

static void
sushi_web_process_extension_init (SushiWebProcessExtension *extension)
{
  extension->cancellable = g_cancellable_new ();
}

static gpointer
sushi_web_process_extension_create_instance (gpointer data)
{
  return g_object_new (SUSHI_TYPE_WEB_PROCESS_EXTENSION, NULL);
}

void
sushi_web_process_extension_initialize (SushiWebProcessExtension  *extension,
                                        WebKitWebProcessExtension *webkit_extension)
{
  g_assert (SUSHI_IS_WEB_PROCESS_EXTENSION (extension));

  if (extension->initialized)
      return;

  extension->initialized = TRUE;
  extension->extension = g_object_ref (webkit_extension);

  g_signal_connect_swapped (extension->extension, "page-created",
                            G_CALLBACK (sushi_web_process_extension_page_created_callback),
                            extension);
  g_signal_connect_swapped (extension->extension, "user-message-received",
                            G_CALLBACK (sushi_web_process_extension_user_message_received_callback),
                            extension);
}

SushiWebProcessExtension *
sushi_web_process_extension_get (void)
{
  static GOnce once_init = G_ONCE_INIT;
  return SUSHI_WEB_PROCESS_EXTENSION (g_once (&once_init, sushi_web_process_extension_create_instance, NULL));
}
