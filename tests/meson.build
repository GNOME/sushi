tests_env = environment()
tests_env.append('MESON_BUILD_ROOT', meson.project_build_root())
tests_env.append('MESON_SOURCE_ROOT', meson.project_source_root())
tests_env.append('GI_TYPELIB_PATH', meson.current_build_dir() / '..' / 'src' / 'libsushi')
tests_env.append('LD_LIBRARY_PATH', meson.current_build_dir() / '..' / 'src' / 'libsushi')

sushi_test_resources = gnome.compile_resources(
  '@0@.test'.format(app_id),
  configure_file(
    input: 'org.gnome.NautilusPreviewer.test.gresource.xml.in',
    output: '@BASENAME@',
    configuration: conf_src,
  ),
  gresource_bundle: true,
  install: false,
)

tests_dependencies = [
  sushi_src_resources,
  sushi_data_resources,
  sushi_test_resources,
  libsushi_gir,
  libsushi_webprocess_extension,
]

tests = ['rendererSelector']

foreach test : tests
  test_conf = configuration_data()
  test_conf.set('package_name', app_id)
  test_conf.set('package_version', meson.project_version())
  test_conf.set('prefix', get_option('prefix'))
  test_conf.set('libdir', libdir)
  test_conf.set('name', test)
  test_conf.set('tests_build_dir', meson.current_build_dir())
  test_conf.set('relative_object_path', relative_object_path)

  configure_file(
    input: 'test.js.in',
    output: '@0@.js'.format(test),
    configuration: test_conf,
  )
  test(test, jasmine,
    args: [
      '--module',
      '--tap',
      '--no-config',
      meson.current_build_dir() / '@0@.js'.format(test),
    ],
    suite: 'unit',
    depends: tests_dependencies,
    env: tests_env,
    protocol: 'tap')
endforeach
