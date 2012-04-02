dnl -*- mode: m4 -*-
AC_PREREQ(2.63)
AC_INIT([sushi],[0.4.0],[],[sushi])

AM_CONFIG_HEADER(config/config.h)
AC_CONFIG_SRCDIR([src/main.c])
AC_CONFIG_MACRO_DIR([m4])
AC_CONFIG_AUX_DIR([config])

m4_ifdef([AM_SILENT_RULES],[AM_SILENT_RULES([yes])])

AC_CANONICAL_TARGET

# require automake 1.10
AM_INIT_AUTOMAKE([1.10 dist-xz no-dist-gzip tar-ustar foreign])
AM_MAINTAINER_MODE([enable])

GETTEXT_PACKAGE=AC_PACKAGE_NAME
AC_SUBST(GETTEXT_PACKAGE)
AC_DEFINE_UNQUOTED(GETTEXT_PACKAGE,"$GETTEXT_PACKAGE",[The name of the gettext domain])
IT_PROG_INTLTOOL(0.40.0)
PKG_PROG_PKG_CONFIG([0.22])

AM_GNU_GETTEXT([external])
AM_GNU_GETTEXT_VERSION([0.17])

GOBJECT_INTROSPECTION_REQUIRE([0.9.6])

## don't rerun to this point if we abort
AC_CACHE_SAVE

AC_PROG_CC
AM_PROG_CC_C_O
AC_PROG_CXX
AC_ISC_POSIX
AC_HEADER_STDC

# no stupid static libraries
AM_DISABLE_STATIC
# enable libtool
AC_PROG_LIBTOOL
# avoid libtool for LTCOMPILE, use it only to link

## don't rerun to this point if we abort
AC_CACHE_SAVE

GJS_JS_DIR=`$PKG_CONFIG --variable=datadir gjs-1.0`/gjs-1.0
AC_SUBST(GJS_JS_DIR)

CLUTTER_MIN_VERSION=1.6.0
GLIB_MIN_VERSION=2.29.14
GTK_MIN_VERSION=3.0.0
GJS_MIN_VERSION=0.7.7
CLUTTER_GTK_MIN_VERSION=1.10.0
GOBJECT_INTROSPECTION_MIN_VERSION=0.9.6
GDK_PIXBUF_MIN_VERSION=2.22.1

PKG_CHECK_MODULES(SUSHI,
                  glib-2.0 >= $GLIB_MIN_VERSION
                  gobject-introspection-1.0 >= $GOBJECT_INTROSPECTION_MIN_VERSION
                  gjs-1.0 >= $GJS_MIN_VERSION
                  gjs-dbus-1.0 >= $GJS_MIN_VERSION
                  gobject-2.0 >= $GLIB_MIN_VERSION
                  clutter-1.0 >= $CLUTTER_MIN_VERSION
                  clutter-x11-1.0 >= $CLUTTER_MIN_VERSION
                  gtk+-3.0 >= $GTK_MIN_VERSION
                  clutter-gtk-1.0 >= $CLUTTER_GTK_MIN_VERSION
                  clutter-gst-1.0
                  gstreamer-0.10
                  gstreamer-pbutils-0.10
                  gstreamer-tag-0.10
                  libmusicbrainz3
                  evince-document-3.0
                  evince-view-3.0
                  gtksourceview-3.0
                  webkitgtk-3.0)

GLIB_MKENUMS=`$PKG_CONFIG --variable=glib_mkenums glib-2.0`
AC_SUBST(GLIB_MKENUMS)

AC_PATH_PROG(UNOCONV, unoconv, 0)
if test x$UNOCONV = x0; then
   HAVE_UNOCONV=0
else
   HAVE_UNOCONV=1
fi

AC_SUBST(HAVE_UNOCONV)

AC_CONFIG_FILES([
Makefile
src/Makefile
data/Makefile
data/style/Makefile
po/Makefile.in
])

AC_OUTPUT

dnl ==========================================================================
echo "

        Sushi $VERSION
        ==================

        prefix:    ${prefix}
        compiler:  ${CC}

        Now type 'make' to build $PACKAGE
"
