#!/usr/bin/env bash

set -euo pipefail

[ ! -d node_modules ] && npm clean-install --install-links
npm run ci:lint -- "$@"
