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
 */

#pragma once

#include <glib-object.h>

#include "externalwindow.h"

#define EXTERNAL_TYPE_WINDOW_WAYLAND (external_window_wayland_get_type ())
#define EXTERNAL_WINDOW_WAYLAND(object) (G_TYPE_CHECK_INSTANCE_CAST (object, EXTERNAL_TYPE_WINDOW_WAYLAND, ExternalWindowWayland))

typedef struct _ExternalWindowWayland ExternalWindowWayland;
typedef struct _ExternalWindowWaylandClass ExternalWindowWaylandClass;

GType external_window_wayland_get_type (void);
ExternalWindowWayland *external_window_wayland_new (const char *handle_str);
