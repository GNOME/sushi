SUBDIRS = style

servicedir = $(datadir)/dbus-1/services
service_in_files = org.gnome.Sushi.service.in
service_DATA = $(service_in_files:.service.in=.service)

org.gnome.Sushi.service: org.gnome.Sushi.service.in Makefile
	$(AM_V_GEN) sed -e "s|\@bindir\@|$(bindir)|" $< > $@

gsettingsschema_in_files = org.gnome.sushi.gschema.xml.in
gsettings_SCHEMAS = $(gsettingsschema_in_files:.xml.in=.xml)
.PRECIOUS: $(gsettings_SCHEMAS)

@INTLTOOL_XML_NOMERGE_RULE@
@GSETTINGS_RULES@

EXTRA_DIST = \
	$(service_in_files) \
	$(gsettingsschema_in_files)

CLEANFILES = \
	$(service_DATA) \
	$(gsettings_SCHEMAS)
