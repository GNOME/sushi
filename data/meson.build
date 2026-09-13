# icon
icondir = join_paths('icons', 'hicolor', 'scalable', 'apps')
install_data(
  join_paths(icondir, f'@app_id@.svg'),
  install_dir: join_paths(datadir, icondir),
  rename: f'@app_id@.svg',
)

conf = configuration_data()

conf.set('libexecdir', libexecdir)
conf.set('app_id', app_id)

configure_file(
  input: 'org.gnome.NautilusPreviewer.service.in',
  output: f'@app_id@.service',
  configuration: conf,
  install_dir: join_paths(datadir, 'dbus-1', 'services'),
)

metainfo_conf = configuration_data()
metainfo_conf.set('app_id', app_id)

release_version = meson.project_version()
if python.found()
  args = '''exec("import re\nprint(re.sub(r'^(.+)(\\.)([a-z]+.*)$', r'\\1~\\3', '@0@'))")'''
  args = args.format(meson.project_version())
  release_version = run_command(python, '-c', args, check: true).stdout().strip()
endif
metainfo_conf.set('release-version', release_version)

i18n.merge_file(
  input: configure_file(
    input: 'org.gnome.NautilusPreviewer.desktop.in.in',
    output: '@BASENAME@',
    configuration: conf,
  ),
  output: f'@app_id@.desktop',
  po_dir: '../po',
  install: true,
  install_dir: join_paths(datadir, 'applications'),
  type: 'desktop',
)

metainfo = i18n.merge_file(
  input: configure_file(
    input: 'org.gnome.NautilusPreviewer.metainfo.xml.in.in',
    output: '@BASENAME@',
    configuration: metainfo_conf,
  ),
  output: f'@app_id@.metainfo.xml',
  po_dir: '../po',
  install: true,
  install_dir: join_paths(datadir, 'metainfo'),
)

sushi_data_resources = gnome.compile_resources(
  f'@app_id@.data',
  configure_file(
    input: 'data.gresource.xml.in',
    output: '@BASENAME@',
    configuration: conf,
  ),
  dependencies: [metainfo],
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)

test(
  'Validate appstream file',
  appstreamcli,
  args: [
    'validate',
    '--pedantic',
    '--no-net',
    '--explain',
    metainfo.full_path(),
  ],
  depends: [metainfo],
)
