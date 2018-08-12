libsushi_c = [
  'sushi-cover-art.c',
  'sushi-file-loader.c',
  'sushi-font-loader.c',
  'sushi-font-widget.c',
  'sushi-pdf-loader.c',
  'sushi-sound-player.c',
  'sushi-text-loader.c',
  'sushi-utils.c',
]

libsushi_headers = [
  'sushi-cover-art.h',
  'sushi-file-loader.h',
  'sushi-font-loader.h',
  'sushi-font-widget.h',
  'sushi-pdf-loader.h',
  'sushi-sound-player.h',
  'sushi-text-loader.h',
  'sushi-utils.h',
]

libsushi_enum = gnome.mkenums(
  'libsushi_enum',
  c_template: 'sushi-enum-types.c.in',
  h_template: 'sushi-enum-types.h.in',
  sources: libsushi_headers,
)

libsushi = shared_library(
  'sushi-1.0',
  dependencies: deps,
  sources: [
    libsushi_c,
    libsushi_enum,
    libsushi_headers,
  ],
  install: true,
  install_dir: join_paths(libdir, 'sushi'),
  include_directories: include_dirs,
)

# We use that later on to link the sushi-start executable against libsushi
libsushi_shared_link = declare_dependency(
  link_with: libsushi,
  dependencies: deps,
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
    'Clutter-1.0',
    'GstPbutils-1.0',
    'GstTag-1.0',
    'GdkPixbuf-2.0',
    'Gtk-3.0',
    'GtkSource-3.0',
    'EvinceDocument-3.0',
  ],
  install: true,
  install_dir_gir: join_paths(datadir, 'sushi', 'gir-1.0'),
  install_dir_typelib: join_paths(libdir, 'sushi', 'girepository-1.0'),
)
