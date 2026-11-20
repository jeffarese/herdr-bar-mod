#!/bin/sh
# The showcase hook for this README: run by the kit's scene.sh
# (~/workspace/herdr/herdr-showcase) after the default scene, with the stage folder.
#
#   w=$(SHOWCASE_TFVPN=0 SHOWCASE_HOOK=$PWD/docs/demo/showcase.sh sh ~/workspace/herdr/herdr-showcase/stage.sh)
#
# The film starts from the default scene with nothing over it: shop's first tab (Claude Code,
# "Speed up the checkout page") in front and two notifications in the corner. film.sh opens
# the bar with its key.
set -eu
w=${1:?usage: showcase.sh <stage folder>}
# shellcheck disable=SC1091
. "$w/env.sh"
herdr-app do overlay.close >/dev/null 2>&1 || :
herdr-app do space.select --index 1 >/dev/null
herdr-app do tab.select --index 1 >/dev/null
