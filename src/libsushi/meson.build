externalwindow_sources = [
  'externalwindow.c',
  'externalwindow.h',
]

libsushi_deps = [
  papers_document_dep,
  papers_view_dep,
  freetype_dep,
  gdk_pixbuf_dep,
  glib_dep,
  gstreamer_dep,
  gst_pbutils_dep,
  gstreamer_tag_dep,
  gtk_dep,
  harfbuzz_dep,
  x11_dep,
]

libsushi_sources = [
  'sushi-font-loader.c',
  'sushi-font-loader.h',
  'sushi-font-widget.c',
  'sushi-font-widget.h',
  'sushi-utils.c',
  'sushi-utils.h',
]

libsushi = shared_library(
  'sushi-1.0',
  dependencies: libsushi_deps,
  sources: [
    externalwindow_sources,
    libsushi_sources,
  ],
  install: true,
  install_dir: pkglibdir
)

gnome.generate_gir(
  libsushi,
  sources: [
    libsushi_sources,
  ],
  nsversion: '1.0',
  namespace: 'Sushi',
  symbol_prefix: 'sushi',
  identifier_prefix: 'Sushi',
  includes: [
    'GstTag-1.0',
    'GdkPixbuf-2.0',
    'Gtk-4.0',
    'PapersDocument-4.0',
    'PapersView-4.0',
  ],
  install: true,
  install_dir_gir: join_paths(pkgdatadir, 'gir-1.0'),
  install_dir_typelib: join_paths(pkglibdir, 'girepository-1.0'),
)
