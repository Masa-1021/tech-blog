#!/bin/bash
set -e

REPO_URL="https://${GITEA_USER}:${GITEA_TOKEN}@d51kcriwd0i85.cloudfront.net/All_Users/tech-blog.git"
POLL_INTERVAL=60

echo "=== Deploy Watcher 起動 ==="
echo "リポジトリ: d51kcriwd0i85.cloudfront.net/All_Users/tech-blog"
echo "監視間隔: ${POLL_INTERVAL}秒"

# 初回クローン
if [ ! -d ".git" ]; then
    echo ">>> 初回クローン中..."
    git clone "$REPO_URL" .
    LAST_COMMIT=$(git rev-parse HEAD)
    echo ">>> クローン完了: $LAST_COMMIT"
    echo ">>> 初回ビルド・デプロイ開始..."
    npm ci --silent
    npm run build
    aws s3 sync out/ "s3://${S3_BUCKET}" --delete
    aws cloudfront create-invalidation \
        --distribution-id "${CF_DISTRIBUTION_ID}" \
        --paths "/*" \
        --output text
    echo ">>> 初回デプロイ完了"
fi

LAST_COMMIT=$(git rev-parse HEAD)

while true; do
    sleep "$POLL_INTERVAL"

    echo "--- $(date '+%Y-%m-%d %H:%M:%S') チェック中..."

    # リモートの最新 commit を取得
    git fetch origin main 2>/dev/null
    REMOTE_COMMIT=$(git rev-parse origin/main)

    if [ "$LAST_COMMIT" != "$REMOTE_COMMIT" ]; then
        echo ">>> 変更検知: $LAST_COMMIT → $REMOTE_COMMIT"
        git pull origin main

        echo ">>> npm ci..."
        npm ci --silent

        echo ">>> ビルド中..."
        npm run build

        echo ">>> S3 デプロイ中..."
        aws s3 sync out/ "s3://${S3_BUCKET}" --delete

        echo ">>> CloudFront キャッシュ削除..."
        aws cloudfront create-invalidation \
            --distribution-id "${CF_DISTRIBUTION_ID}" \
            --paths "/*" \
            --output text

        LAST_COMMIT="$REMOTE_COMMIT"
        echo ">>> デプロイ完了: $REMOTE_COMMIT"
    else
        echo "--- 変更なし"
    fi
done
