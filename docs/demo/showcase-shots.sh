#!/bin/sh
# Makes the README's film and still again, from nothing: builds a showcase stage without the
# VPN switch, with showcase.sh as its hook, films it with film.sh and takes the stage down.
# Needs the kit at ~/workspace/herdr/herdr-showcase (or SHOWCASE_KIT).
#
#   sh docs/demo/showcase-shots.sh            a stage of its own, taken down after
#   sh docs/demo/showcase-shots.sh <stage>    on a stage you built (with showcase.sh), left up
#
# docs/media/demo.mp4, docs/media/demo.gif   the film: the bar over the cockpit, real keys
# preview.png                                the bar open on the agent that needs you
#
# The film can't be a burst of the kit's shoot.sh (that can't press keys between frames), so
# film.sh takes the same lock, waits for the same minute of nobody typing, and brings the stage
# forward and gives the front back the same way (README.md).
set -eu
here=$(cd "$(dirname "$0")" && pwd -P)
kit=${SHOWCASE_KIT:-$HOME/workspace/herdr/herdr-showcase}
if [ -n "${1:-}" ]; then
  w=$(cd "$1" && pwd -P)
else
  w=$(SHOWCASE_TFVPN=0 SHOWCASE_HOOK="$here/showcase.sh" sh "$kit/stage.sh")
  trap 'sh "$kit/stage.sh" --down "$w"' EXIT
fi
sh "$here/film.sh" "$w"
