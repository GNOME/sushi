#!/usr/bin/env python3

import os
import subprocess
import sys

destdir = os.environ.get('DESTDIR', '')
libexecdir = sys.argv[1]
bindir = sys.argv[2]

bindir = os.path.join(destdir, bindir)
os.makedirs(bindir, exist_ok=True)

src = os.path.join(libexecdir, 'org.gnome.NautilusPreviewer')
dest = os.path.join(bindir, 'sushi')
subprocess.call(['ln', '-s', '-f', src, dest])
