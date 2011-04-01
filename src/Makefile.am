AM_CPPFLAGS = \
    -I$(top_builddir)/config \
    -I$(top_srcdir)	\
    -L$(top_srcdir)/src \
    -DNAUTILUS_PREVIEW_LIBDIR=\"$(libdir)\" \
    -DNAUTILUS_PREVIEW_DATADIR=\"$(datadir)\" \
    -DNAUTILUS_PREVIEW_TOP_SRCDIR=\"$(abs_top_srcdir)\" \
    -DNAUTILUS_PREVIEW_BUILDDIR=\"$(abs_top_builddir)\"

bin_PROGRAMS = nautilus-preview

nautilus_preview_SOURCES = main.c

nautilus_preview_LDADD = \
    $(NAUTILUS_PREVIEW_LIBS)
nautilus_preview_CPPFLAGS = \
    $(NAUTILUS_PREVIEW_CFLAGS) \
    $(AM_CPPFLAGS) \
    -DLOCALEDIR=\"$(datadir)/locale\"