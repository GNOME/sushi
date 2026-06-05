#!/usr/bin/env bash

format_options=(--editor-config --recursive)
meson format "${format_options[@]}" --check-only || (
    echo "meson.build files do not match the expected format"
    echo "run 'meson format ${format_options[*]} --inplace' to apply the standard formatting"
    exit 1
)
