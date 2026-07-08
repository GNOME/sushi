// SPDX-License-Identifier: GPL-2.0-or-later WITH GStreamer-exception-2008
// SPDX-FileCopyrightText: 2026 The Sushi authors

#pragma once

#include <glib.h>

G_BEGIN_DECLS

#define SUSHI_ERROR sushi_error_quark ()

typedef enum
{
  SUSHI_ERROR_OTHER,
  /*< private >*/
  SUSHI_ERROR_LAST,
} SushiError;

GQuark sushi_error_quark (void);

G_END_DECLS
