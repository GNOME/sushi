gnome = import('gnome')

# Compile libsushi and its introspection data
subdir('libsushi')

sushi_data_resources = gnome.compile_resources(
    'org.gnome.NautilusPreviewer.data',
    'org.gnome.NautilusPreviewer.data.gresource.xml',
    gresource_bundle: true,
    install: true,
    install_dir: pkgdatadir,
)

sushi_src_resources = gnome.compile_resources(
    'org.gnome.NautilusPreviewer.src',
    'org.gnome.NautilusPreviewer.src.gresource.xml',
    gresource_bundle: true,
    install: true,
    install_dir: pkgdatadir,
)

nautilus_previewer_dbus_sources = gnome.gdbus_codegen(
    'nautilus-previewer-dbus',
    sources: 'org.gnome.NautilusPreviewer.xml',
    interface_prefix : 'org.gnome.',
    annotations: ['org.gnome.NautilusPreviewer', 'org.gtk.GDBus.C.Name', 'NautilusPreviewerDBus']
)

nautilus_previewer_dbus_lib = shared_library(
    'nautilus-previewer-dbus-1.0',
    nautilus_previewer_dbus_sources,
    version: meson.project_version(),
    dependencies: [gio_unix_dep],
    install: true,
    install_dir: pkglibdir
)

gnome.generate_gir(
    nautilus_previewer_dbus_lib,
    sources: nautilus_previewer_dbus_sources,
    namespace: 'NautilusPreviewerDBus',
    nsversion: '1.0',
    includes: ['Gio-2.0'],
    install: true,
    install_dir_gir: join_paths(pkgdatadir, 'gir-1.0'),
    install_dir_typelib: join_paths(pkglibdir, 'girepository-1.0')
)

conf = configuration_data()
conf.set('GJS', gjs.path())
conf.set('PACKAGE_NAME', meson.project_name())
conf.set('PACKAGE_VERSION', meson.project_version())
conf.set('prefix', get_option('prefix'))
conf.set('libdir', libdir)

sushi_bin = configure_file(
  input: 'org.gnome.NautilusPreviewer.in',
  output: 'org.gnome.NautilusPreviewer',
  configuration: conf,
)

install_data(
  sushi_bin,
  install_mode: 'rwxr-xr-x',
  install_dir: libexecdir,
)
