/*
 * Copyright © 2016 Red Hat, Inc
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library. If not, see <http://www.gnu.org/licenses/>.
 *
 * Authors:
 *       Jonas Ådahl <jadahl@redhat.com>
 *       Corey Berla <corey@berla.me>
 */

#include <string.h>

#include <gtk/gtk.h>

#ifdef GDK_WINDOWING_WAYLAND
#include <gdk/wayland/gdkwayland.h>
#endif

#ifdef GDK_WINDOWING_X11
#include <gdk/x11/gdkx.h>
#endif

#include "externalwindow.h"

struct _ExternalWindow
{
  GObject parent_instance;
};

typedef struct _ExternalWindowPrivate
{
  GdkDisplay *display;
  char *wayland_str;
  Window xid;
} ExternalWindowPrivate;

G_DEFINE_TYPE_WITH_CODE (ExternalWindow, external_window, G_TYPE_OBJECT,
                         G_ADD_PRIVATE (ExternalWindow));

ExternalWindow *
create_external_window_from_handle (const char *handle_str)
{
    ExternalWindow *external_window;
    ExternalWindowPrivate *priv;
    const char x11_prefix[] = "x11:";
    const char wayland_prefix[] = "wayland:";

    external_window = g_object_new (EXTERNAL_TYPE_WINDOW, NULL);
    priv = external_window_get_instance_private (external_window);

  if (g_str_has_prefix (handle_str, x11_prefix))
    {
      const char *x11_handle_str = handle_str + strlen (x11_prefix);

      priv->xid = strtol (x11_handle_str, NULL, 16);
      priv->wayland_str = NULL;
      return external_window;
    }
  else if (g_str_has_prefix (handle_str, wayland_prefix))
    {
      const char *wayland_handle_str = handle_str + strlen (wayland_prefix);

      priv->wayland_str = g_strdup (wayland_handle_str);
      priv->xid = 0;
      return external_window;
    }

  g_warning ("Unhandled parent window type %s\n", handle_str);
  return NULL;
}

void
external_window_set_parent_of (ExternalWindow *external_window,
                               GtkWindow      *child_window)
{
    GdkSurface *surface = gtk_native_get_surface (GTK_NATIVE (child_window));
    ExternalWindowPrivate *priv = external_window_get_instance_private (external_window);

#ifdef GDK_WINDOWING_WAYLAND
    if (GDK_IS_WAYLAND_DISPLAY (gtk_widget_get_display (GTK_WIDGET (child_window))))
    {
        if (priv->xid)
        {
            g_warning ("Wayland / x11 mismatch");
            return;
        }

        if (!gdk_wayland_toplevel_set_transient_for_exported (GDK_TOPLEVEL (surface), priv->wayland_str))
          g_warning ("Failed to set portal window transient for external parent");

        return;
    }
#endif

#ifdef GDK_WINDOWING_X11
    if (GDK_IS_X11_DISPLAY (gtk_widget_get_display (GTK_WIDGET (child_window))))
      {
        GdkDisplay *display = gtk_widget_get_display (GTK_WIDGET (child_window));
        Display *dpy = gdk_x11_display_get_xdisplay (display);
        Window parent_xid = gdk_x11_surface_get_xid (surface);

        if (priv->wayland_str)
        {
            g_warning ("Wayland / x11 mismatch");
            return;
        }

        if (!XSetTransientForHint (dpy, parent_xid, priv->xid))
          g_warning ("Failed to set portal window transient for external parent");

        return;
      }
#endif
}

static void
external_window_dispose (GObject *object)
{
    ExternalWindow *self = EXTERNAL_WINDOW (object);
    ExternalWindowPrivate *priv = external_window_get_instance_private (self);

    g_clear_pointer (&priv->wayland_str, g_free);

    G_OBJECT_CLASS (external_window_parent_class)->dispose (object);
}

static void
external_window_init (ExternalWindow *external_window)
{
}

static void
external_window_class_init (ExternalWindowClass *klass)
{
    GObjectClass *object_class = G_OBJECT_CLASS (klass);

    object_class->dispose = external_window_dispose;
}
