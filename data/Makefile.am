servicedir = $(datadir)/dbus-1/services
service_in_files = org.gnome.NautilusPreviewer.service.in
service_DATA = $(service_in_files:.service.in=.service)

org.gnome.NautilusPreviewer.service: org.gnome.NautilusPreviewer.service.in Makefile
	$(AM_V_GEN) sed -e "s|\@bindir\@|$(bindir)|" $< > $@

EXTRA_DIST = \
	$(service_in_files)

CLEANFILES = \
	$(service_DATA)

-include $(top_srcdir)/git.mk
