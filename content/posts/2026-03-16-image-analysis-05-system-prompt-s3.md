---
title: "AIの性格は設定ファイルで変える"
emoji: "💬"
type: "tech"
topics: ["AWS", "S3", "Bedrock", "PromptEngineering"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "システムプロンプトをS3に外部化し、再デプロイなしで変更する方法。キャッシュとA/Bテストの実装例。"
series: "製造業向けAI画像分析システムを作る"
seriesOrder: 5
coverImage: "/images/posts/laptop-code.jpg"
---

# AIの性格は設定ファイルで変える

> **このシリーズ: 全10回**
> 1. [第1回: AIの回答を待ちきれない？30秒の壁を乗り越える方法](/posts/2026-03-16-image-analysis-01-lambda-streaming)
> 2. [第2回: 工場の図面をAIに読ませたい](/posts/2026-03-16-image-analysis-02-factory-image-analysis)
> 3. [第3回: Amazon BedrockでAIチャットを作る](/posts/2026-03-16-image-analysis-03-bedrock-api-guide)
> 4. [第4回: 「しばらくお待ちください」で終わらせない](/posts/2026-03-16-image-analysis-04-error-handling)
> 5. [第5回: AIの性格は設定ファイルで変える](/posts/2026-03-16-image-analysis-05-system-prompt-s3) ← 今ここ
> 6. [第6回: 会話履歴を賢く管理する](/posts/2026-03-16-image-analysis-06-dynamodb-conversation)
> 7. [第7回: ログイン機能を30分で実装](/posts/2026-03-16-image-analysis-07-cognito-auth)
> 8. [第8回: 文字が流れるように表示される仕組み](/posts/2026-03-16-image-analysis-08-streaming-display)
> 9. [第9回: React+TypeScriptで型安全なチャット画面を作る](/posts/2026-03-16-image-analysis-09-react-typescript-chat)
> 10. [第10回: サーバー代を半分にした話](/posts/2026-03-16-image-analysis-10-aws-cost-optimization)


S3を使ったシステムプロンプト管理

## はじめに

AIチャットボットの応答品質を大きく左右するのが「システムプロンプト」です。

「あなたは製造業の専門家です。グラフを分析し、問題点を指摘してください。」

このような指示を与えることで、AIの「性格」や「専門性」を定義できます。しかし、このプロンプトをコードに直接書いていませんか？

本記事では、システムプロンプトをS3に外部化し、再デプロイなしで調整できる仕組みを解説します。

## システムプロンプトとは

### AIへの「役割指示」

システムプロンプトは、AIに「あなたはこういう存在です」と伝える指示文です。

```
システムプロンプトなし：
User: このグラフを見てください
AI: はい、何かご質問はありますか？（一般的な応答）

システムプロンプトあり：
[System: あなたは製造業の生産管理の専門家です。
グラフから問題点を見つけ、改善提案をしてください。]

User: このグラフを見てください
AI: このグラフを分析すると、以下の問題点が見られます...
    1. 午前10時頃に稼働率が急落しています
    2. 計画値との乖離が15%を超えています
    改善提案として...（専門的な応答）
```

### なぜ「性格」と呼ぶのか

システムプロンプトは、人間で言う「性格」や「専門分野」に相当します。

- **丁寧に答える** → 「敬語で丁寧に回答してください」
- **簡潔に答える** → 「箇条書きで簡潔に回答してください」
- **専門家として** → 「あなたは〇〇の専門家です」
- **優しく教える** → 「初心者にも分かりやすく説明してください」

## コードに書く問題点

### 変更のたびにデプロイが必要

システムプロンプトをコードに埋め込むと、小さな修正でも再デプロイが必要です。

```python
# ❌ コードに直接書く場合
SYSTEM_PROMPT = """
あなたは製造業の生産管理の専門家です。
グラフを分析し、以下の観点で問題点を指摘してください：
- 計画と実績の乖離
- 異常値の検出
- 改善提案
"""

def invoke_bedrock(user_message: str):
    # ...
```

**問題点：**
- プロンプト修正 → コード変更 → テスト → デプロイ → 反映
- 1つの修正に30分〜1時間かかることも
- デプロイ失敗のリスクもある

### チームでの調整が難しい

- エンジニア以外がプロンプトを調整できない
- 「この言い回しを変えたい」だけでも開発依頼が必要
- バージョン管理がコードと混在して複雑

## S3に外部化するメリット

### デプロイなしで変更可能

```
変更の流れ：
1. S3のファイルを編集
2. 保存
3. 反映（数秒〜数分）

開発者の作業時間：1分
```

Lambdaを再デプロイする必要がありません。プロンプトファイルをS3にアップロードするだけで、次のリクエストから新しいプロンプトが使われます。

### 非エンジニアでも編集可能

S3のファイルは、AWS Consoleからテキストエディタ感覚で編集できます。

```
1. AWS Consoleにログイン
2. S3 → バケットを選択
3. prompts/graph-analysis.txt を開く
4. 編集して保存
```

プロダクトマネージャーやドメインエキスパートが、直接プロンプトを調整できるようになります。

### バージョン管理

S3のバージョニング機能を有効にすると、過去の状態に簡単に戻せます。

```
prompts/graph-analysis.txt
├── 最新版（12/10 15:30）
├── 1つ前（12/10 10:00）
├── 2つ前（12/9 18:00）
└── 3つ前（12/8 14:00）  ← いつでも復元可能
```

## 実装してみよう

### S3にファイルを置く

まず、プロンプトファイルの構成を決めます。

```
s3://your-bucket/
└── prompts/
    ├── graph-analysis.txt      # グラフ分析用
    ├── table-extraction.txt    # 表抽出用
    └── general-chat.txt        # 一般チャット用
```

### プロンプトファイルの例

```text
# prompts/graph-analysis.txt

あなたは製造業の生産管理の専門家です。

## 役割
ユーザーがアップロードした稼働実績グラフを分析し、問題点と改善提案を提示してください。

## 分析の観点
1. 計画値と実績値の乖離
2. 異常値や急激な変化
3. トレンドの変化
4. 周期的なパターン

## 出力フォーマット
以下の形式で回答してください：

### 分析結果
- 発見した問題点を箇条書きで列挙

### 詳細分析
- 各問題点の詳細説明

### 改善提案
- 具体的なアクション提案

## 注意事項
- 数値は正確に読み取ってください
- 不明確な部分は「推定」と明記してください
- 専門用語は初心者にも分かるよう説明を加えてください
```

### Lambdaから読み込む

```python
# backend/services/prompt_loader.py

import boto3
import logging
import os
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

s3 = boto3.client('s3')

# キャッシュの有効期限（秒）
CACHE_TTL = 300  # 5分

# キャッシュ
_prompt_cache: dict[str, tuple[str, datetime]] = {}


def load_system_prompt(prompt_type: str) -> str:
    """
    S3からシステムプロンプトを読み込む

    Args:
        prompt_type: プロンプトの種類（"graph-analysis", "table-extraction"など）

    Returns:
        システムプロンプトの内容
    """
    bucket = os.environ['PROMPT_BUCKET']
    key = f"prompts/{prompt_type}.txt"

    # キャッシュをチェック
    if prompt_type in _prompt_cache:
        content, cached_at = _prompt_cache[prompt_type]
        if datetime.now() - cached_at < timedelta(seconds=CACHE_TTL):
            logger.debug(f"キャッシュヒット: {prompt_type}")
            return content

    # S3から読み込み
    try:
        response = s3.get_object(Bucket=bucket, Key=key)
        content = response['Body'].read().decode('utf-8')

        # キャッシュに保存
        _prompt_cache[prompt_type] = (content, datetime.now())

        logger.info(f"プロンプト読み込み: {key}")
        return content

    except Exception as e:
        logger.error(f"プロンプト読み込みエラー: {e}")

        # フォールバック（デフォルトプロンプト）
        return "あなたは親切なアシスタントです。ユーザーの質問に丁寧に答えてください。"
```

### 使い方

```python
# backend/chat_handler.py

from services.prompt_loader import load_system_prompt

def handle_chat(event, context):
    # リクエストからプロンプトタイプを取得
    body = json.loads(event['body'])
    prompt_type = body.get('promptType', 'general-chat')

    # S3からプロンプトを読み込み
    system_prompt = load_system_prompt(prompt_type)

    # Bedrockを呼び出し
    response = invoke_bedrock(
        user_message=body['message'],
        system_prompt=system_prompt,
        # ...
    )
```

### キャッシュで高速化

S3への毎回のアクセスは、レイテンシーとコストの両面で無駄です。キャッシュを使って効率化します。

```python
# キャッシュの動作イメージ

リクエスト1: S3から読み込み → キャッシュに保存 → 応答
リクエスト2: キャッシュから取得 → 応答（高速）
リクエスト3: キャッシュから取得 → 応答（高速）
...
（5分経過）
リクエストN: キャッシュ期限切れ → S3から再読み込み → 応答
```

## プロンプトの書き方Tips

### 製造業向けの例

**グラフ分析用：**
```text
あなたは製造業の生産管理コンサルタントです。
20年の経験を持ち、稼働実績グラフの分析が専門です。

## あなたの強み
- 微細な変化も見逃さない観察力
- 根本原因を特定する分析力
- 実現可能な改善提案

## 分析時の注意
- 数値は画像から正確に読み取る
- 推測には「推定」と明記
- 改善提案は具体的なアクションで
```

**表抽出用：**
```text
あなたはデータ入力の専門家です。
画像に含まれる表を正確にテキスト化することが任務です。

## 出力ルール
- Markdown表形式で出力
- 数値は桁を正確に
- 読み取れない部分は [不明] と記載
- 単位は必ず付ける
```

### 良いプロンプトのポイント

**1. 役割を明確に**
```text
❌ 曖昧: AIとして回答してください
✅ 明確: あなたは製造業20年のベテランコンサルタントです
```

**2. 出力形式を指定**
```text
❌ 曖昧: 分析結果を教えてください
✅ 明確: 以下のJSON形式で出力してください：
        {"issues": [...], "recommendations": [...]}
```

**3. 禁止事項を書く**
```text
## やってはいけないこと
- 不確かな情報を断定的に述べる
- 専門用語を説明なしで使う
- 「分かりません」だけで終わる
```

## 運用のコツ

### 変更履歴を残す

プロンプトファイルの先頭に変更履歴を残すと、後で振り返りやすくなります。

```text
# システムプロンプト: グラフ分析

## 変更履歴
- 2025/12/10: 出力形式をMarkdownに統一
- 2025/12/05: 異常値検出の観点を追加
- 2025/12/01: 初版作成

---

あなたは製造業の生産管理の専門家です。
...
```

### A/Bテストの方法

複数バージョンのプロンプトを試して、効果を比較できます。

```
s3://your-bucket/prompts/
├── graph-analysis.txt       # 本番用
├── graph-analysis-v2.txt    # テスト用A
└── graph-analysis-v3.txt    # テスト用B
```

```python
# フロントエンドでバージョンを指定
const promptType = isTestUser
  ? 'graph-analysis-v2'
  : 'graph-analysis';
```

### 効果測定

- ユーザーの満足度（フィードバック機能）
- 回答の正確性（サンプリング検証）
- 処理時間の変化

## CDKでの設定

### S3バケットの作成

```typescript
// infrastructure/lib/image-analysis-stack.ts

const promptBucket = new s3.Bucket(this, 'PromptBucket', {
  bucketName: 'your-prompt-bucket',
  versioned: true,  // バージョニング有効
  encryption: s3.BucketEncryption.S3_MANAGED,
});

// Lambdaにアクセス権限を付与
promptBucket.grantRead(chatFunction);

// 環境変数で渡す
chatFunction.addEnvironment('PROMPT_BUCKET', promptBucket.bucketName);
```

### プロンプトのデプロイ

```bash
# プロンプトファイルをS3にアップロード
aws s3 cp prompts/graph-analysis.txt s3://your-prompt-bucket/prompts/
aws s3 cp prompts/table-extraction.txt s3://your-prompt-bucket/prompts/
```

## まとめ

### S3外部化のメリット

| 観点 | コード埋め込み | S3外部化 |
|-----|--------------|---------|
| 変更速度 | 30分〜1時間 | 1分 |
| 編集者 | エンジニアのみ | 誰でも |
| バージョン管理 | コードと混在 | 独立 |
| ロールバック | デプロイ必要 | ワンクリック |
| A/Bテスト | 複雑 | 簡単 |

### 設定例一覧

```
prompts/
├── graph-analysis.txt      # 稼働実績グラフ分析
├── table-extraction.txt    # 表データ抽出
├── quality-check.txt       # 品質検査画像分析
└── general-chat.txt        # 一般的な質問応答
```

### チェックリスト

- [ ] S3バケットの作成（バージョニング有効）
- [ ] Lambdaへの読み取り権限付与
- [ ] キャッシュ機能の実装
- [ ] フォールバックプロンプトの用意
- [ ] 変更履歴の記録ルール策定

## 参考リンク

- [Prompt Engineering Guide](https://www.promptingguide.ai/)
- [S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)
- [Claude System Prompts](https://docs.anthropic.com/claude/docs/system-prompts)
