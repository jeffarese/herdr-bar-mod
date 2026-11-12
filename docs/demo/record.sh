#!/bin/sh
# Films the README's demo again: builds the stage, fills it, films it and takes the stage down.
#
#   sh docs/demo/record.sh
set -eu
kit=$(cd "$(dirname "$0")" && pwd)
w=$(sh "$kit/stage.sh")
trap 'sh "$kit/stage.sh" --down "$w"' EXIT
sh "$kit/scene.sh" "$w"
sh "$kit/film.sh" "$w"
