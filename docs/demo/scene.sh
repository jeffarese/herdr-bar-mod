#!/bin/sh
# Fills a stage (stage.sh) with the demo's cast: three projects on this computer and one on
# studio, with agents in every status, a sub-agent and two plain shells.
#
#   sh docs/demo/scene.sh <stage folder>
set -eu
w=${1:?usage: scene.sh <stage folder>}
# shellcheck disable=SC1091
. "$w/env.sh"

# The projects: empty git repositories, each on the branch its rows show.
project() { # project <folder> <branch>
  mkdir -p "$1"
  git -C "$1" init -q -b "$2"
  git -C "$1" -c user.name=demo -c user.email=demo@example.com commit -q --allow-empty -m "start"
}
project "$HOME/code/shop" checkout-speed
project "$HOME/code/api" retry-webhooks
project "$HOME/code/docs" main
project "$w/studio/code/search" reindex

space() { herdr-app do space.new "$@" >/dev/null; }
tab() { herdr-app do tab.new "$@" >/dev/null; }

space --folder "$HOME/code/docs" --argv '["codex","--then","done","--after","8","Update the docs for the new API"]'
space --folder "$HOME/code/api" --argv '["claude","--spawn","review=codex Review the retry change","Add retries to the webhook client"]'
tab --folder "$HOME/code/api" --argv '["claude","--state","blocked","--ask","Run npm run test:integration?","Fix the login redirect loop"]'
tab --folder "$HOME/code/api"
space --machine studio --folder "$w/studio/code/search" --argv '["claude","Benchmark the search index"]'
tab --folder "$w/studio/code/search" --argv '["codex","--state","idle","Tune the ranking weights"]'
space --folder "$HOME/code/shop" --argv '["claude","Speed up the checkout page"]'
tab --folder "$HOME/code/shop" --argv '["codex","--state","idle","Migrate the cart to the new API"]'
tab --folder "$HOME/code/shop"
# The docs agent finishes while nobody looks, so it stays done. The film opens in the first
# tab of the shop.
herdr-app do tab.select --index 1 >/dev/null
sleep 14
