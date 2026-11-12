#!/bin/sh
# Install the Bar mod into the Herdr app, or update it.
#
#   ./install.sh            copy mods/bar into the app's home and open it once
#   ./install.sh --remove   close it and delete it from the app's home
#
# Without a clone, the script fetches the mod itself:
#
#   curl -fsSL https://raw.githubusercontent.com/jeffarese/herdr-bar-mod/main/install.sh | sh
#
# The app's home is ~/.config/herdr-app, or $HERDR_APP_HOME.
set -eu
here=$(cd "$(dirname "$0")" 2>/dev/null && pwd || pwd)
home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
dest="$home/mods/bar"
app=$(command -v herdr-app 2>/dev/null || echo "$HOME/.local/bin/herdr-app")

[ -d "$home/mods" ] || { echo "No Herdr app home at $home. Start the Herdr app once first." >&2; exit 1; }
running() { [ -x "$app" ] && "$app" status >/dev/null 2>&1; }

if [ "${1:-}" = "--remove" ]; then
  if running; then "$app" do overlay.close >/dev/null 2>&1 || :; fi
  rm -rf "$dest"
  echo "Removed the Bar mod. Take its key out of keys.json too."
  exit 0
fi

# Run from a pipe, or from a copy of this file alone: fetch the rest.
if [ ! -f "$here/mods/bar/main.js" ]; then
  tarball=${HERDR_BAR_MOD_TARBALL:-https://github.com/jeffarese/herdr-bar-mod/archive/refs/heads/main.tar.gz}
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL "$tarball" | tar -xz -C "$tmp" --strip-components 1
  [ -f "$tmp/mods/bar/main.js" ] || { echo "Couldn't fetch the mod from $tarball" >&2; exit 1; }
  here=$tmp
fi

was_there=0
[ -d "$dest" ] && was_there=1
mkdir -p "$dest"
cp "$here"/mods/bar/*.js "$here"/mods/bar/*.json "$here"/mods/bar/*.svg "$dest/"

if [ -x "$app" ]; then "$app" check "$dest"; fi
if [ $was_there = 1 ]; then
  echo "Updated the Bar mod. The app reloads it by itself."
elif running; then
  "$app" do mod.open --name bar >/dev/null
  echo "Installed. The Bar is open in Herdr. Bind a key to it: see the README."
else
  echo "Installed. With Herdr open, run: herdr-app do mod.open --name bar"
fi
