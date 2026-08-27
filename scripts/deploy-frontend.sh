#!/bin/bash -e

s3_url="s3://vatiris.se"
distribution_id="EHGETQBI2R76M"

# Check that we have access to the correct AWS account
aws_account_id=$(aws sts get-caller-identity --query "Account" --output text)
if [ "$aws_account_id" != "802367033029" ]; then
    echo "Wrong AWS account $aws_account_id! Check your ~/.aws/credentials"
    exit 1
fi

cd "$(dirname $0)/../frontend"

# The CARTO basemap key is not stored in the repo, it comes from frontend/.env.local
# or the environment. Vite only picks up VITE_-prefixed variables, so export it.
if [ -z "$VITE_CARTO_KEY" ] && [ -f .env.local ]; then
    export VITE_CARTO_KEY=$(grep -E '^VITE_CARTO_KEY=' .env.local | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r')
fi
if [ -z "$VITE_CARTO_KEY" ]; then
    echo "VITE_CARTO_KEY is not set! Put it in frontend/.env.local or export it before deploying."
    exit 1
fi

npm install
npm run build
aws s3 sync dist/ $s3_url --delete --acl public-read
aws cloudfront create-invalidation --distribution-id $distribution_id --paths '/*'
