#!/usr/bin/env sh
# Pull the brand marks from GitHub rather than copying them out of the checkout
# next door, so this page ships the same files a visitor to the repository sees.
#
# Two sources answer with the same bytes and they are checked against each
# other: `main` is what the repository holds now, and the release asset is what
# the tag froze. When they differ the page is being built against an unreleased
# mark and the script says so instead of picking one.
set -eu

REPO=blackswanalpha/bundlebox
TAG=${1:-v0.5.0}
DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/public
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DIR"
for f in logo.svg logo-wordmark.svg; do
  curl -fsSL -o "$DIR/$f" "https://raw.githubusercontent.com/$REPO/main/assets/$f"
  echo "  main     public/$f  $(wc -c <"$DIR/$f") bytes"
done

# Only logo.svg is attached to the release; the wordmark lives in the tree only,
# so there is nothing to compare it against and the script does not pretend
# otherwise.
if command -v gh >/dev/null 2>&1 && gh release download "$TAG" --repo "$REPO" \
     --pattern 'logo.svg' --dir "$TMP" --clobber >/dev/null 2>&1; then
  if cmp -s "$TMP/logo.svg" "$DIR/logo.svg"; then
    echo "  $TAG   public/logo.svg  identical to main"
  else
    echo "  $TAG   public/logo.svg  DIFFERS from main — the mark moved since the tag" >&2
    exit 1
  fi
else
  echo "  $TAG   not checked (no gh, or the tag has no logo.svg)"
fi
