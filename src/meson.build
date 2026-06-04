# Compile libsushi and its introspection data
subdir('libsushi')

conf_src = configuration_data()
conf_src.set('relative_object_path', relative_object_path)

sushi_src_resources = gnome.compile_resources(
    '@0@.src'.format(app_id),
    configure_file(
      input: 'org.gnome.NautilusPreviewer.src.gresource.xml.in',
      output: '@BASENAME@',
      configuration: conf_src
    ),
    gresource_bundle: true,
    install: true,
    install_dir: pkgdatadir,
)

conf = configuration_data()
conf.set('GJS', gjs.full_path())
conf.set('PACKAGE_NAME', meson.project_name())
conf.set('PACKAGE_VERSION', meson.project_version())
conf.set('prefix', get_option('prefix'))
conf.set('libdir', libdir)
conf.set('pkgdatadir', pkgdatadir)
conf.set('app_id', app_id)
conf.set('relative_object_path', relative_object_path)

nautilus_previewer_bin = configure_file(
    input: 'org.gnome.NautilusPreviewer.in',
    output: app_id,
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

devel_env = environment()
devel_env.append('GI_TYPELIB_PATH', meson.current_build_dir() / 'libsushi')
devel_env.append('LD_LIBRARY_PATH', meson.current_build_dir() / 'libsushi')
devel_env.append('SUSHI_PERSIST', '1')
run_target(
    'devel',
    command: [gjs, nautilus_previewer_bin],
    depends: [sushi_src_resources, sushi_data_resources, libsushi_gir],
    env: devel_env,
)
