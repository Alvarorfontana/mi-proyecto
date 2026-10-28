#!/bin/bash
# Instala Typst y pandoc dentro del Codespace (una sola vez).
set -e
cd /tmp
curl -sSL https://github.com/typst/typst/releases/download/v0.13.1/typst-x86_64-unknown-linux-musl.tar.xz | tar xJ
sudo cp typst-x86_64-unknown-linux-musl/typst /usr/local/bin/
curl -sSL -o pandoc.deb https://github.com/jgm/pandoc/releases/download/3.6.4/pandoc-3.6.4-1-amd64.deb
sudo dpkg -i pandoc.deb
pip install --quiet pypdf
echo "✓ Listo: typst $(typst --version | cut -d' ' -f2), pandoc $(pandoc --version | head -1 | cut -d' ' -f2)"
