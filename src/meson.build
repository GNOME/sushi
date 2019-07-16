gnome = import('gnome')

# Compile libsushi and its introspection data
subdir('libsushi')

sushi_src_resources = gnome.compile_resources(
    'org.gnome.NautilusPreviewer.src',
    'org.gnome.NautilusPreviewer.src.gresource.xml',
    gresource_bundle: true,
    install: true,
    install_dir: pkgdatadir,
)

sushi_data_resources = gnome.compile_resources(
    'org.gnome.NautilusPreviewer.data',
    'org.gnome.NautilusPreviewer.data.gresource.xml',
    gresource_bundle: true,
    install: true,
    install_dir: pkgdatadir,
)

conf = configuration_data()
conf.set('GJS', gjs.path())
conf.set('PACKAGE_NAME', meson.project_name())
conf.set('PACKAGE_VERSION', meson.project_version())
conf.set('prefix', get_option('prefix'))
conf.set('libdir', libdir)
conf.set('pkgdatadir', pkgdatadir)

nautilus_previewer_bin = configure_file(
  input: 'org.gnome.NautilusPreviewer.in',
  output: 'org.gnome.NautilusPreviewer',
  configuration: conf,
)

install_data(
  nautilus_previewer_bin,
  install_mode: 'rwxr-xr-x',
  install_dir: libexecdir,
)

sushi_bin = configure_file(
  input: 'sushi.in',
  output: 'sushi',
  configuration: conf,
)

install_data(
  sushi_bin,
  install_mode: 'rwxr-xr-x',
  install_dir: bindir,
)
