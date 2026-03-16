---
title: "会話履歴を賢く管理する"
emoji: "🗄️"
type: "tech"
topics: ["AWS", "DynamoDB", "Python", "Chat"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "DynamoDBのGSI・TTLを使ったマルチユーザー対応の会話履歴管理。セッション設計とトークン削減の実践。"
series: "製造業向けAI画像分析システムを作る"
seriesOrder: 6
coverImage: "/images/posts/coding-screen.jpg"
---

# 会話履歴を賢く管理する

> **このシリーズ: 全10回**
> 1. [第1回: AIの回答を待ちきれない？30秒の壁を乗り越える方法](/posts/2026-03-16-image-analysis-01-lambda-streaming)
> 2. [第2回: 工場の図面をAIに読ませたい](/posts/2026-03-16-image-analysis-02-factory-image-analysis)
> 3. [第3回: Amazon BedrockでAIチャットを作る](/posts/2026-03-16-image-analysis-03-bedrock-api-guide)
> 4. [第4回: 「しばらくお待ちください」で終わらせない](/posts/2026-03-16-image-analysis-04-error-handling)
> 5. [第5回: AIの性格は設定ファイルで変える](/posts/2026-03-16-image-analysis-05-system-prompt-s3)
> 6. [第6回: 会話履歴を賢く管理する](/posts/2026-03-16-image-analysis-06-dynamodb-conversation) ← 今ここ
> 7. [第7回: ログイン機能を30分で実装](/posts/2026-03-16-image-analysis-07-cognito-auth)
> 8. [第8回: 文字が流れるように表示される仕組み](/posts/2026-03-16-image-analysis-08-streaming-display)
> 9. [第9回: React+TypeScriptで型安全なチャット画面を作る](/posts/2026-03-16-image-analysis-09-react-typescript-chat)
> 10. [第10回: サーバー代を半分にした話](/posts/2026-03-16-image-analysis-10-aws-cost-optimization)


DynamoDBで作るマルチユーザー対応チャット

## はじめに

AIチャットボットを作ると、必ず直面する問題があります。

「さっき話したこと、覚えてる？」

AIは本来、会話の「記憶」を持ちません。毎回のリクエストは独立しており、前の質問を覚えていないのです。

本記事では、DynamoDBを使って会話履歴を保存し、AIに「記憶」を持たせる方法を解説します。

## なぜ会話履歴が必要か

### AIに「記憶」を持たせる

会話履歴がないと、こんな不自然なやり取りになります。

```
ユーザー: このグラフの問題点を教えて
AI: このグラフには3つの問題点があります...

ユーザー: 1番目について詳しく教えて
AI: 何の1番目でしょうか？（前の会話を覚えていない）
```

会話履歴があれば、自然な対話ができます。

```
ユーザー: このグラフの問題点を教えて
AI: このグラフには3つの問題点があります...

ユーザー: 1番目について詳しく教えて
AI: 1番目の「午前10時の稼働率低下」について詳しく説明します...
   （前の会話を参照して回答）
```

### 仕組み

```
[ユーザーのメッセージ]
        ↓
[過去の会話履歴を取得] ← DynamoDB
        ↓
[履歴 + 新メッセージをAIに送信]
        ↓
[AIの回答を保存] → DynamoDB
        ↓
[回答を返す]
```

## DynamoDBを選んだ理由

### サーバーレスと相性抜群

DynamoDBは「フルマネージド」のデータベースです。

- サーバーの管理が不要
- 自動でスケール
- 従量課金（使った分だけ）

Lambdaと同じく、サーバーを意識せずに使えます。

### 高速な読み書き

チャットアプリでは、レスポンス速度が重要です。

- **読み取り**: 数ミリ秒
- **書き込み**: 数ミリ秒

RDBのような複雑なクエリは苦手ですが、「キーで取得」「キーで保存」はとても高速です。

## テーブル設計の考え方

### キーの設計

DynamoDBでは「キー」の設計が最も重要です。

```
テーブル名: ConversationHistory

パーティションキー: sessionId  (文字列)
ソートキー: timestamp         (数値)
```

**パーティションキー（sessionId）**
- 「どの会話か」を識別
- 同じセッションのメッセージは同じパーティションに入る

**ソートキー（timestamp）**
- 「いつのメッセージか」を識別
- 時系列で並べられる

### なぜこの設計か

**1つの会話をまとめて取得**

```python
# セッションID「session-123」の全メッセージを取得
response = table.query(
    KeyConditionExpression=Key('sessionId').eq('session-123')
)
```

**時系列で並べられる**

```python
# 最新5件を取得
response = table.query(
    KeyConditionExpression=Key('sessionId').eq('session-123'),
    ScanIndexForward=False,  # 降順（新しい順）
    Limit=5
)
```

### データ構造

```json
{
  "sessionId": "session-abc123",
  "timestamp": 1702234567890,
  "userId": "user-xyz789",
  "role": "user",
  "content": "このグラフを分析してください",
  "imageUrl": "s3://bucket/images/graph.png",
  "ttl": 1704826567
}
```

| 属性 | 説明 |
|-----|-----|
| sessionId | 会話のID（パーティションキー） |
| timestamp | メッセージの時刻（ソートキー） |
| userId | ユーザーID（Cognito） |
| role | 発言者（user または assistant） |
| content | メッセージ本文 |
| imageUrl | 添付画像のS3 URL（オプション） |
| ttl | 自動削除時刻（オプション） |

## マルチユーザー対応

### 問題：ユーザーごとの一覧が欲しい

基本の設計では、「セッションID」で検索できます。でも、「このユーザーのセッション一覧」を取得したい場合は？

```python
# ❌ これはできない
table.query(
    KeyConditionExpression=Key('userId').eq('user-xyz789')
)
# → エラー: userIdはパーティションキーではない
```

### 解決策：GSI（グローバルセカンダリインデックス）

GSIは「別の検索軸」を追加する機能です。

```
メインテーブル:
  パーティションキー: sessionId
  ソートキー: timestamp

GSI（UserIdIndex）:
  パーティションキー: userId
  ソートキー: timestamp
```

これで、両方の検索ができます。

```python
# セッションIDで検索（メインテーブル）
table.query(
    KeyConditionExpression=Key('sessionId').eq('session-abc123')
)

# ユーザーIDで検索（GSI）
table.query(
    IndexName='UserIdIndex',
    KeyConditionExpression=Key('userId').eq('user-xyz789')
)
```

### 実装例：CDKでの設定

```typescript
// infrastructure/lib/image-analysis-stack.ts

const conversationTable = new dynamodb.Table(this, 'ConversationTable', {
  tableName: 'ConversationHistory',
  partitionKey: {
    name: 'sessionId',
    type: dynamodb.AttributeType.STRING,
  },
  sortKey: {
    name: 'timestamp',
    type: dynamodb.AttributeType.NUMBER,
  },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl',  // TTL有効化
});

// GSIを追加
conversationTable.addGlobalSecondaryIndex({
  indexName: 'UserIdIndex',
  partitionKey: {
    name: 'userId',
    type: dynamodb.AttributeType.STRING,
  },
  sortKey: {
    name: 'timestamp',
    type: dynamodb.AttributeType.NUMBER,
  },
});
```

### 実装例：クエリの書き方

```python
# backend/services/conversation_repository.py

import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ConversationHistory')


def get_conversation(session_id: str) -> list[dict]:
    """
    セッションの会話履歴を取得
    """
    response = table.query(
        KeyConditionExpression=Key('sessionId').eq(session_id),
        ScanIndexForward=True  # 古い順
    )
    return response.get('Items', [])


def get_user_sessions(user_id: str, limit: int = 20) -> list[dict]:
    """
    ユーザーのセッション一覧を取得
    """
    response = table.query(
        IndexName='UserIdIndex',
        KeyConditionExpression=Key('userId').eq(user_id),
        ScanIndexForward=False,  # 新しい順
        Limit=limit
    )
    return response.get('Items', [])


def save_message(
    session_id: str,
    user_id: str,
    role: str,
    content: str,
    image_url: str | None = None,
) -> None:
    """
    メッセージを保存
    """
    import time

    timestamp = int(time.time() * 1000)  # ミリ秒
    ttl = int(time.time()) + (30 * 24 * 60 * 60)  # 30日後

    item = {
        'sessionId': session_id,
        'timestamp': timestamp,
        'userId': user_id,
        'role': role,
        'content': content,
        'ttl': ttl,
    }

    if image_url:
        item['imageUrl'] = image_url

    table.put_item(Item=item)
```

## 自動削除でコスト削減

### 古いデータは不要

30日前の会話を見返すことは、ほとんどありません。古いデータを残しておくと、ストレージコストがかさみます。

### TTL（Time To Live）の活用

DynamoDBのTTL機能を使うと、指定時刻に自動でデータが削除されます。

```python
# 30日後のUnixタイムスタンプ
ttl = int(time.time()) + (30 * 24 * 60 * 60)

item = {
    'sessionId': session_id,
    'timestamp': timestamp,
    'ttl': ttl,  # この時刻になったら自動削除
    # ...
}
```

**ポイント：**
- TTLはUnixタイムスタンプ（秒）で指定
- 削除は「だいたいその時刻」に行われる（数分〜数時間の誤差あり）
- 削除されたデータはコストがかからない

### 効果

```
TTLなし: 会話データが永遠に増え続ける
  → 1年後: 1000万レコード → ストレージ代 $XX/月

TTLあり: 常に直近30日分のみ
  → 1年後でも: 100万レコード → ストレージ代 $X/月
```

## 会話履歴をAIに渡す

### 全部渡す必要はない

会話履歴を全部AIに送ると、問題が発生します。

1. **トークン数の制限** - Claudeには入力制限がある
2. **コストの問題** - 入力トークンが増えると料金も増える
3. **処理時間** - 入力が多いと応答が遅くなる

### 直近5件だけ渡す

実験の結果、直近5件で十分な文脈が得られることが分かりました。

```python
def build_messages_for_bedrock(
    session_id: str,
    new_message: str,
) -> list[dict]:
    """
    Bedrockに送るメッセージを構築
    """
    # 会話履歴を取得
    history = get_conversation(session_id)

    # 直近5件に絞る
    recent_history = history[-5:] if len(history) > 5 else history

    messages = []

    # 過去の会話を追加
    for msg in recent_history:
        messages.append({
            'role': msg['role'],
            'content': msg['content']
        })

    # 新しいメッセージを追加
    messages.append({
        'role': 'user',
        'content': new_message
    })

    return messages
```

### なぜ5件か

```
1件: 文脈不足（直前の質問しか分からない）
3件: 最低限の文脈
5件: 十分な文脈（ほとんどのケースで問題なし）
10件: 過剰（コストと速度のバランスが悪い）
```

特殊なユースケース（長い議論の要約など）では、件数を増やすことも検討してください。

## まとめ

### テーブル設計のポイント

| 設計要素 | 選択 | 理由 |
|---------|-----|-----|
| パーティションキー | sessionId | 会話単位でグループ化 |
| ソートキー | timestamp | 時系列での並べ替え |
| GSI | UserIdIndex | ユーザー別検索 |
| 課金モード | PAY_PER_REQUEST | 予測困難なトラフィックに対応 |
| TTL | 有効（30日） | 古いデータの自動削除 |

### コスト最適化のまとめ

```
✅ やるべきこと:
- TTLで古いデータを自動削除
- AIには直近5件だけ送る
- PAY_PER_REQUESTで使った分だけ課金

❌ やってはいけないこと:
- 全履歴を永遠に保存
- 全履歴をAIに送信
- 事前にキャパシティを確保（予測が難しい）
```

### チェックリスト

- [ ] テーブルの作成（sessionId + timestamp）
- [ ] GSIの追加（UserIdIndex）
- [ ] TTLの有効化
- [ ] メッセージ保存処理の実装
- [ ] 履歴取得処理の実装
- [ ] 直近N件に絞る処理の実装

## 参考リンク

- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Global Secondary Indexes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html)
- [Time to Live (TTL)](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)
