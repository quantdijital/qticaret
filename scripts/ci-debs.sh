#!/usr/bin/env bash
# Usage: ci-debs.sh <name> <package>...
# Installs apt packages from ~/.cache/qt-debs/<name> when the Actions cache
# restored them there, else from the mirror, keeping the downloaded packages
# in that folder for the cache to save (adr/0081). A restored set the runner's
# libraries no longer fit falls back to the mirror.
set -euo pipefail

name="$1"
shift
dir="$HOME/.cache/qt-debs/$name"
mkdir -p "$dir"

if compgen -G "$dir/*.deb" >/dev/null; then
  if sudo dpkg -i "$dir"/*.deb >/dev/null 2>&1; then
    echo "ci-debs: $name installed from the cache ($(find "$dir" -name '*.deb' | wc -l) packages)"
    exit 0
  fi
  echo "ci-debs: the cached packages do not fit this runner; installing from the mirror"
  sudo rm -f "$dir"/*.deb
fi

sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
  -o Dir::Cache::archives="$dir" -o APT::Keep-Downloaded-Packages=true "$@"
sudo chown -R "$(id -u):$(id -g)" "$dir"
rm -rf "$dir/partial" "$dir/lock"
echo "ci-debs: $name installed from the mirror ($(find "$dir" -name '*.deb' | wc -l) packages kept)"
