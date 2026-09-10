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

metainfo = i18n.merge_file(
  input: configure_file(
    input: 'org.gnome.NautilusPreviewer.metainfo.xml.in.in',
    output: '@BASENAME@',
    configuration: conf,
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
