#!/bin/bash

# brew install poppler jq

[ "$WIKI_TOKEN" ] || { echo "WIKI_TOKEN not set"; exit 1; }
[ "$WIKI_SECRET" ] || { echo "WIKI_SECRET not set"; exit 1; }

which pdftoppm >/dev/null || { echo "pdftoppm not found"; exit 1; }
which jq >/dev/null || { echo "jq not found"; exit 1; }

cd "$(dirname "$0")/.."

generate() {
    attachment=$1 ; shift
    filename=$1 ; shift
    curl -s "https://wiki.vatsim-scandinavia.org/api/attachments/$attachment" \
        -H "Authorization: Token $WIKI_TOKEN:$WIKI_SECRET" \
        | jq -r .content | base64 -D | pdftoppm -png - frontend/public/quickref/$filename
}

generate 118 esgg
generate 119 essa-twr
generate 120 essa-app
generate 121 essb
