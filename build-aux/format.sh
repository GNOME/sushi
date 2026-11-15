#!/usr/bin/env bash

LANG=C.utf8

status=0

build-aux/format-blueprint.sh || status=1
build-aux/format-meson.sh || status=1
build-aux/run-eslint.sh || status=1

git diff --exit-code | tee style-check.diff

exit $status
