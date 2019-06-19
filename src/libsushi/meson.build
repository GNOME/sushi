libsushi_deps = [
  epoxy_dep,
  evince_document_dep,
  evince_view_dep,
  freetype_dep,
  gdk_pixbuf_dep,
  glib_dep,
  gstreamer_dep,
  gstreamer_audio_dep,
  gstreamer_tag_dep,
  gstreamer_video_dep,
  gtk_dep,
  harfbuzz_dep,
  musicbrainz_dep
]

libsushi_c = [
  'sushi-font-loader.c',
  'sushi-font-widget.c',
  'sushi-media-bin.c',
  'sushi-utils.c',
]

libsushi_headers = [
  'sushi-font-loader.h',
  'sushi-font-widget.h',
  'sushi-media-bin.h',
  'sushi-utils.h',
]

libsushi_enum = gnome.mkenums(
  'libsushi_enum',
  c_template: 'sushi-enum-types.c.in',
  h_template: 'sushi-enum-types.h.in',
  sources: libsushi_headers,
)

libsushi_resource = gnome.compile_resources(
  'sushi-lib-resources',
  'org.gnome.Libsushi.gresource.xml',
  c_name: 'sushi'
)

libsushi = shared_library(
  'sushi-1.0',
  dependencies: libsushi_deps,
  sources: [
    libsushi_c,
    libsushi_enum,
    libsushi_headers,
    libsushi_resource
  ],
  install: true,
  install_dir: pkglibdir
)

gnome.generate_gir(
  libsushi,
  sources: [
    libsushi_c,
    libsushi_enum,
    libsushi_headers,
  ],
  nsversion: '1.0',
  namespace: 'Sushi',
  symbol_prefix: 'sushi',
  identifier_prefix: 'Sushi',
  includes: [
    'GstTag-1.0',
    'GdkPixbuf-2.0',
    'Gtk-3.0',
    'EvinceDocument-3.0',
    'EvinceView-3.0',
  ],
  install: true,
  install_dir_gir: join_paths(pkgdatadir, 'gir-1.0'),
  install_dir_typelib: join_paths(pkglibdir, 'girepository-1.0'),
)
