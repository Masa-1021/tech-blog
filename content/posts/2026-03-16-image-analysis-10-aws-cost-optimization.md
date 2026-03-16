---
title: "サーバー代を半分にした話"
emoji: "💰"
type: "tech"
topics: ["AWS", "CostOptimization", "Bedrock", "Lambda"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "AWSコストを54%削減した実践例。S3ライフサイクル・DynamoDB TTL・Bedrockトークン削減・CloudFrontの最適化。"
series: "製造業向けAI画像分析システムを作る"
seriesOrder: 10
coverImage: "/images/posts/coding-screen.jpg"
---

# サーバー代を半分にした話

> **このシリーズ: 全10回**
> 1. [第1回: AIの回答を待ちきれない？30秒の壁を乗り越える方法](/posts/2026-03-16-image-analysis-01-lambda-streaming)
> 2. [第2回: 工場の図面をAIに読ませたい](/posts/2026-03-16-image-analysis-02-factory-image-analysis)
> 3. [第3回: Amazon BedrockでAIチャットを作る](/posts/2026-03-16-image-analysis-03-bedrock-api-guide)
> 4. [第4回: 「しばらくお待ちください」で終わらせない](/posts/2026-03-16-image-analysis-04-error-handling)
> 5. [第5回: AIの性格は設定ファイルで変える](/posts/2026-03-16-image-analysis-05-system-prompt-s3)
> 6. [第6回: 会話履歴を賢く管理する](/posts/2026-03-16-image-analysis-06-dynamodb-conversation)
> 7. [第7回: ログイン機能を30分で実装](/posts/2026-03-16-image-analysis-07-cognito-auth)
> 8. [第8回: 文字が流れるように表示される仕組み](/posts/2026-03-16-image-analysis-08-streaming-display)
> 9. [第9回: React+TypeScriptで型安全なチャット画面を作る](/posts/2026-03-16-image-analysis-09-react-typescript-chat)
> 10. [第10回: サーバー代を半分にした話](/posts/2026-03-16-image-analysis-10-aws-cost-optimization) ← 今ここ


AWSコスト最適化の実践

## はじめに

「サーバーレスはお金がかからない」

そう思っていた時期が私にもありました。

実際にアプリを公開してみると、予想以上にコストがかかることに気づきます。特にAI関連のサービスは、使い方次第で請求額が大きく変わります。

本記事では、製造業向け画像分析アプリで実践したコスト最適化の方法を紹介します。結果として、**月額コストを54%削減**できました。

## コスト構造を把握する

### どこにお金がかかっているか

まず、AWSの請求内訳を確認しました。

```
月間コスト内訳（最適化前）:
┌─────────────────────────────────┐
│ Bedrock API    $150.00 (97.7%) │ ███████████████████████████████
│ Lambda           $1.67 (1.1%)  │ █
│ S3               $1.15 (0.7%)  │
│ DynamoDB         $0.65 (0.4%)  │
│ その他            $0.07 (0.1%)  │
├─────────────────────────────────┤
│ 合計           $153.54         │
└─────────────────────────────────┘
```

**97%がBedrock（AI）のコスト**という衝撃の事実。

### 最大の敵はBedrock

Amazon Bedrockは「トークン課金」です。

| 項目 | 料金（Claude 3.5 Sonnet） |
|-----|--------------------------|
| 入力トークン | $0.003 / 1,000トークン |
| 出力トークン | $0.015 / 1,000トークン |

**1回の画像分析の例：**
- 入力: 画像(約3,000トークン) + プロンプト(500トークン) + 履歴(2,000トークン) = 5,500トークン
- 出力: 回答(1,000トークン)

```
1回のコスト:
  入力: 5,500 × $0.003 / 1,000 = $0.0165
  出力: 1,000 × $0.015 / 1,000 = $0.0150
  合計: $0.0315 / リクエスト

1日100リクエスト × 30日 = 3,000リクエスト
3,000 × $0.0315 = $94.50 / 月
```

画像を含めると、さらにトークン数が増えます。

## 最適化1：S3ライフサイクル

### 問題：古い画像が溜まる

ユーザーがアップロードした画像は、S3に保存されます。しかし、30日前の画像を見返すことはほとんどありません。

```
uploads/
├── 2025-12-01/ (100MB)
├── 2025-11-01/ (100MB)
├── 2025-10-01/ (100MB)
├── ...
└── 2025-01-01/ (100MB)

→ 1年で1.2GB → $0.027/月 × 12ヶ月 = 増え続ける
```

### 解決：30日で自動削除

S3のライフサイクルルールで、古いファイルを自動削除します。

```typescript
// infrastructure/lib/image-analysis-stack.ts

const imageBucket = new s3.Bucket(this, 'ImageBucket', {
  bucketName: 'your-image-bucket',

  // ライフサイクルルール
  lifecycleRules: [
    {
      id: 'DeleteOldUploads',
      prefix: 'uploads/',  // 対象フォルダ
      expiration: cdk.Duration.days(30),  // 30日後に削除
      enabled: true,
    },
  ],
});
```

### 効果

```
Before: 50GB → $1.15/月
After:  10GB → $0.23/月
削減:   80%
```

## 最適化2：DynamoDB TTL

### 問題：会話履歴が永遠に残る

チャットの履歴は、DynamoDBに保存されます。でも、古い履歴を見返すユーザーはほとんどいません。

```
ConversationHistory テーブル:
├── session-001 (2025-12-01) ← 最近
├── session-002 (2025-11-15)
├── session-003 (2025-10-01)
├── ...
└── session-999 (2025-01-01) ← 1年前、誰も見ない

→ レコード数が増え続ける → ストレージ代が増加
```

### 解決：30日で自動削除

DynamoDBのTTL（Time To Live）機能を使います。

```python
# backend/services/conversation_repository.py

import time

def save_message(session_id: str, content: str, ...):
    # 30日後のUnixタイムスタンプ
    ttl = int(time.time()) + (30 * 24 * 60 * 60)

    table.put_item(Item={
        'sessionId': session_id,
        'timestamp': int(time.time() * 1000),
        'content': content,
        'ttl': ttl,  # この時刻に自動削除
        # ...
    })
```

```typescript
// infrastructure/lib/image-analysis-stack.ts

const conversationTable = new dynamodb.Table(this, 'ConversationTable', {
  tableName: 'ConversationHistory',
  partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },

  // TTLを有効化
  timeToLiveAttribute: 'ttl',

  // 従量課金モード
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
});
```

### 効果

```
Before: 無制限保存 → $0.65/月
After:  30日分のみ → $0.20/月
削減:   69%
```

## 最適化3：Bedrockトークン削減

### 問題：トークン使いすぎ

コストの97%を占めるBedrockを最適化しないと意味がありません。

調査すると、以下の無駄が見つかりました。

1. **会話履歴を全部送っている** - 10件の履歴で20,000トークン
2. **毎回画像を送っている** - フォローアップ質問でも画像を再送信
3. **max_tokensが大きすぎ** - 4096設定だが、平均出力は800

### 解決策

**1. 履歴は直近5件だけ**

```python
# 会話履歴を取得
history = get_conversation(session_id)

# 直近5件に絞る
recent_history = history[-5:] if len(history) > 5 else history
```

**2. 画像は必要なときだけ**

```python
def should_include_image(messages: list, new_message: str) -> bool:
    """
    画像を含めるべきか判定
    """
    # 最初のメッセージ：含める
    if len(messages) == 0:
        return True

    # 「もう一度見て」系のキーワード：含める
    keywords = ['画像', 'グラフ', '図', '見て', '確認']
    if any(kw in new_message for kw in keywords):
        return True

    # それ以外：含めない
    return False
```

**3. max_tokensを適正化**

```python
request_body = {
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 2048,  # 4096 → 2048に削減
    # ...
}
```

### 効果

```
Before: 50M トークン/月 → $150.00
After:  22.5M トークン/月 → $67.50
削減:   55%
```

## 最適化4：CloudFront + S3ホスティング

### 問題：EC2は高い

フロントエンドをEC2でホスティングしていませんか？

```
EC2 t3.micro (24時間稼働):
  $0.0104/時間 × 24時間 × 30日 = $7.49/月

※ 誰もアクセスしない深夜も稼働
```

### 解決：静的ホスティング

Reactアプリはビルドすると静的ファイルになります。S3 + CloudFrontで配信できます。

```bash
# ビルド
cd frontend
npm run build

# S3にアップロード
aws s3 sync dist/ s3://your-web-bucket/

# CloudFrontのキャッシュを削除
aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"
```

```typescript
// infrastructure/lib/image-analysis-stack.ts

// S3バケット（静的ホスティング）
const webBucket = new s3.Bucket(this, 'WebBucket', {
  websiteIndexDocument: 'index.html',
  websiteErrorDocument: 'index.html',  // SPAのルーティング対応
  publicReadAccess: true,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
});

// CloudFront
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(webBucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  },
  defaultRootObject: 'index.html',
  errorResponses: [
    {
      httpStatus: 404,
      responsePagePath: '/index.html',
      responseHttpStatus: 200,
    },
  ],
});
```

### 効果

```
Before: EC2 t3.micro → $7.50/月
After:  CloudFront + S3 → $0.50/月
削減:   93%
```

## CDKでインフラ管理

### コードで設定を管理

AWS CDKを使うと、インフラ設定をコードで管理できます。

```
メリット：
- 再現性がある（同じ環境を何度でも作れる）
- バージョン管理できる（Gitで履歴管理）
- レビューできる（PRでチェック）
```

### 主要な設定

```typescript
// infrastructure/lib/image-analysis-stack.ts

export class ImageAnalysisStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3バケット（ライフサイクル付き）
    const imageBucket = new s3.Bucket(this, 'ImageBucket', {
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(30),
          prefix: 'uploads/',
        },
      ],
    });

    // DynamoDB（TTL付き）
    const table = new dynamodb.Table(this, 'ConversationTable', {
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Lambda
    const chatFunction = new lambda.Function(this, 'ChatFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      memorySize: 256,  // 最小限のメモリ
      timeout: cdk.Duration.seconds(30),
    });
  }
}
```

## コスト監視

### Cost Explorerの活用

AWSのCost Explorerで、日次のコストを確認できます。

```bash
# AWS CLIでコスト確認
aws ce get-cost-and-usage \
  --time-period Start=2025-12-01,End=2025-12-31 \
  --granularity DAILY \
  --metrics UnblendedCost \
  --group-by Type=SERVICE
```

### アラームの設定

1日のコストが閾値を超えたら通知を受け取ります。

```typescript
// 日次コストアラーム
const costAlarm = new cloudwatch.Alarm(this, 'DailyCostAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/Billing',
    metricName: 'EstimatedCharges',
    statistic: 'Maximum',
    period: cdk.Duration.hours(6),
    dimensionsMap: {
      Currency: 'USD',
    },
  }),
  threshold: 10,  // $10を超えたらアラート
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
});

// SNSで通知
costAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));
```

## まとめ

### 削減効果

| 項目 | Before | After | 削減率 |
|-----|--------|-------|--------|
| Bedrock | $150.00 | $67.50 | 55% |
| S3 | $1.15 | $0.23 | 80% |
| DynamoDB | $0.65 | $0.20 | 69% |
| Lambda | $1.67 | $1.67 | 0% |
| その他 | $0.07 | $0.07 | 0% |
| **合計** | **$153.54** | **$69.67** | **54%** |

### 3つの原則

**1. 不要なデータは消す**
- S3ライフサイクルで古いファイルを削除
- DynamoDB TTLで古いレコードを削除

**2. 必要最小限を送る**
- 会話履歴は直近5件
- 画像は必要なときだけ
- max_tokensは適正値に

**3. 常時起動を避ける**
- EC2 → CloudFront + S3
- Lambda は使った分だけ課金

### チェックリスト

- [ ] S3ライフサイクルの設定
- [ ] DynamoDB TTLの有効化
- [ ] Bedrockトークン削減（履歴制限）
- [ ] Bedrockトークン削減（画像送信最適化）
- [ ] max_tokensの適正化
- [ ] 静的ホスティングへの移行
- [ ] Cost Explorerの定期確認
- [ ] コストアラームの設定

## 参考リンク

- [AWS Cost Explorer](https://aws.amazon.com/aws-cost-management/aws-cost-explorer/)
- [S3 Lifecycle Configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)
- [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
