# Deploy Watcher - 社内サーバーセットアップ手順

Gitea への push を検知し、自動でビルド・S3 デプロイするサービスです。

## 前提条件

社内サーバーに以下がインストールされていること。

- WSL2（Ubuntu 推奨）
- Docker + Docker Compose

---

## セットアップ手順

### 1. WSL を開く

社内サーバーで WSL（Ubuntu）のターミナルを開く。

### 2. このフォルダを社内サーバーにコピーする

開発PC（このリポジトリ）の `deploy-service/` フォルダを社内サーバーに転送する。

```bash
# 開発PCで実行（社内サーバーのIPに合わせて変更）
scp -r deploy-service/ user@<社内サーバーIP>:~/tech-blog-deploy/
```

または USB・共有フォルダ経由でコピーしても OK。

### 3. 社内サーバーの WSL で作業ディレクトリに移動

```bash
cd ~/tech-blog-deploy
```

### 4. .env ファイルを作成

```bash
cp .env.example .env
```

`.env.example` の内容がそのまま本番用設定になっています。
**`.env` ファイルは他人に見せないこと。**

### 5. Docker イメージをビルド＆起動

```bash
docker compose up -d --build
```

### 6. 動作確認

ログを確認する。

```bash
docker compose logs -f
```

以下のように表示されれば正常稼働中：

```
=== Deploy Watcher 起動 ===
リポジトリ: d51kcriwd0i85.cloudfront.net/All_Users/tech-blog
監視間隔: 60秒
>>> 初回クローン中...
>>> 初回デプロイ完了
--- 2026-03-23 10:00:00 チェック中...
--- 変更なし
```

---

## 通常の使い方

セットアップ後は何もしなくて OK。

1. 開発PC で記事を書いて `git push` する
2. 最大 60 秒後に自動でビルド・デプロイが始まる
3. 約 2〜3 分後にサイトに反映される

---

## 停止・再起動

```bash
# 停止
docker compose down

# 再起動
docker compose up -d

# ログ確認
docker compose logs -f
```

## サーバー再起動時の自動起動

`docker compose up -d` で起動したコンテナは `restart: unless-stopped` が設定されているため、**サーバー再起動後も自動で再開**されます。

ただし Docker 自体が自動起動するよう設定されている必要があります。

```bash
# Docker の自動起動を有効化（WSL の場合）
sudo systemctl enable docker
```

---

## トラブルシューティング

### ログにエラーが出る場合

```bash
docker compose logs --tail=50
```

### コンテナを入り直して確認

```bash
docker compose exec deploy-watcher bash
```

### 強制的に再デプロイしたい場合

```bash
docker compose down
docker volume rm tech-blog-deploy_repo-cache
docker compose up -d --build
```
