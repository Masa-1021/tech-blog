#!/bin/bash
set -e

S3_BUCKET="blogstack-sitebucket-east1-338658063532"
CF_DISTRIBUTION_ID="E1KKE3I5GVIO45"
REGION="us-east-1"

echo "🔨 Building..."
npm run build

echo "📤 Uploading to S3..."
aws s3 sync out/ "s3://${S3_BUCKET}" --delete --region "${REGION}"

echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "${CF_DISTRIBUTION_ID}" \
  --paths "/*" \
  --query 'Invalidation.Status' \
  --output text

echo "✅ Deploy complete! https://dwkpbncqk2toe.cloudfront.net/"
