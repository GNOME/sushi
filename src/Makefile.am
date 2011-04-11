AM_CPPFLAGS = \
    -I$(top_builddir)/config \
    -I$(top_srcdir)	\
    -L$(top_srcdir)/src \
    -DNAUTILUS_PREVIEW_LIBDIR=\"$(libdir)\" \
    -DNAUTILUS_PREVIEW_DATADIR=\"$(datadir)\" \
    -DNAUTILUS_PREVIEW_PKGDATADIR=\"$(pkgdatadir)\" \
    -DNAUTILUS_PREVIEW_TOP_SRCDIR=\"$(abs_top_srcdir)\" \
    -DNAUTILUS_PREVIEW_BUILDDIR=\"$(abs_top_builddir)\"

BUILT_SOURCES =
EXTRA_DIST =
CLEANFILES =

# convenience command for doing Makefile variable substitutions in non-Makefile
# files (scripts, service files, etc.)
do_subst = sed -e 's|@abs_top_srcdir[@]|$(abs_top_srcdir)|g' \
               -e 's|@abs_top_builddir[@]|$(abs_top_builddir)|g' \
               -e 's|@localedir[@]|$(localedir)|g' \
               -e 's|@bindir[@]|$(bindir)|g' \
               -e 's|@libexecdir[@]|$(libexecdir)|g' \
	       -e 's|@pkglibdir[@]|$(pkglibdir)|g' \
	       -e 's|@pkgdatadir[@]|$(pkgdatadir)|g'

include Makefile-js.am

libexec_PROGRAMS = nautilus-preview-start

nautilus_preview_start_SOURCES = main.c

nautilus_preview_start_LDADD = \
    $(NAUTILUS_PREVIEW_LIBS)
nautilus_preview_start_CPPFLAGS = \
    $(NAUTILUS_PREVIEW_CFLAGS) \
    $(AM_CPPFLAGS) \
    -DLOCALEDIR=\"$(datadir)/locale\"

bin_SCRIPTS = nautilus-preview

nautilus-preview: nautilus-preview.in
	$(AM_V_GEN) $(do_subst) $< > $@
	chmod +x $@

CLEANFILES += nautilus-preview
EXTRA_DIST += nautilus-preview.in
