---
title: "Amazon BedrockでAIチャットを作る"
emoji: "🤖"
type: "tech"
topics: ["AWS", "Bedrock", "Claude", "AI"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "Bedrock Runtime APIとAgents APIの違いを比較。画像分析・チャット・RAGそれぞれのユースケースで選ぶべきAPIを解説。"
series: "製造業向けAI画像分析システムを作る"
seriesOrder: 3
coverImage: "/images/posts/code-editor.jpg"
---


> **このシリーズ: 全10回**
> 1. [第1回: AIの回答を待ちきれない？30秒の壁を乗り越える方法](/posts/2026-03-16-image-analysis-01-lambda-streaming)
> 2. [第2回: 工場の図面をAIに読ませたい](/posts/2026-03-16-image-analysis-02-factory-image-analysis)
> 3. [第3回: Amazon BedrockでAIチャットを作る](/posts/2026-03-16-image-analysis-03-bedrock-api-guide) ← 今ここ
> 4. [第4回: 「しばらくお待ちください」で終わらせない](/posts/2026-03-16-image-analysis-04-error-handling)
> 5. [第5回: AIの性格は設定ファイルで変える](/posts/2026-03-16-image-analysis-05-system-prompt-s3)
> 6. [第6回: 会話履歴を賢く管理する](/posts/2026-03-16-image-analysis-06-dynamodb-conversation)
> 7. [第7回: ログイン機能を30分で実装](/posts/2026-03-16-image-analysis-07-cognito-auth)
> 8. [第8回: 文字が流れるように表示される仕組み](/posts/2026-03-16-image-analysis-08-streaming-display)
> 9. [第9回: React+TypeScriptで型安全なチャット画面を作る](/posts/2026-03-16-image-analysis-09-react-typescript-chat)
> 10. [第10回: サーバー代を半分にした話](/posts/2026-03-16-image-analysis-10-aws-cost-optimization)


Runtime API と Agents API の選び方ガイド

## はじめに

「AWSでAIチャットを作りたい」と思ったとき、Amazon Bedrockは有力な選択肢です。しかし、いざ使おうとすると「APIが2種類ある」ことに気づきます。

- **Bedrock Runtime API**
- **Bedrock Agents API**

どちらを使えばいいのでしょうか？本記事では、この2つの違いと選び方を解説します。

## Runtime API：シンプルに使いたいなら

### 特徴

Runtime APIは、AIモデルを「直接呼び出す」方式です。

```
あなたのコード → Runtime API → Claude（AIモデル）
                    ↓
              「この画像を分析して」
                    ↓
              「この画像は...」
```

**メリット：**
- シンプルで分かりやすい
- 細かい制御が可能
- コストが低い

**デメリット：**
- 複雑な処理は自分で組む必要がある
- 外部ツールとの連携も自前実装

### 向いているケース

1. **画像分析**
   - 画像を見せて質問する
   - グラフや図表の読み取り

2. **シンプルなQ&A**
   - 質問に答える
   - 文章を要約する

3. **独自ロジックを組みたい**
   - 会話の流れを細かく制御
   - 特殊な前処理・後処理

### コード例：基本的な呼び出し方

```python
# backend/services/bedrock_invoker.py

import boto3
import json

bedrock = boto3.client('bedrock-runtime', region_name='us-west-2')

def invoke_claude(prompt: str) -> str:
    """
    Claudeモデルを呼び出す（最もシンプルな形）
    """
    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ]
    }

    response = bedrock.invoke_model(
        modelId="anthropic.claude-3-5-sonnet-20241022-v2:0",
        body=json.dumps(request_body)
    )

    result = json.loads(response['body'].read())
    return result['content'][0]['text']
```

### コード例：画像付きメッセージ

```python
def invoke_with_image(prompt: str, image_base64: str) -> str:
    """
    画像を含むメッセージを送信
    """
    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    }

    response = bedrock.invoke_model(
        modelId="anthropic.claude-3-5-sonnet-20241022-v2:0",
        body=json.dumps(request_body)
    )

    result = json.loads(response['body'].read())
    return result['content'][0]['text']
```

## Agents API：複雑なタスクを任せたいなら

### 特徴

Agents APIは、AIが「自分で判断して動く」方式です。

```
あなたのコード → Agents API → エージェント
                                 ↓
                          「予約を取りたい」
                                 ↓
                          1. カレンダーを確認
                          2. 空き時間を検索
                          3. 予約を作成
                          4. 確認メールを送信
```

**メリット：**
- 複雑なタスクを自動化
- 外部ツールを簡単に使える
- RAG（検索拡張生成）が組み込み

**デメリット：**
- セットアップが複雑
- コストが高い
- 動作の予測が難しい

### 向いているケース

1. **複数ステップの処理**
   - データベースを検索して回答
   - 複数のAPIを組み合わせる

2. **外部システムとの連携**
   - CRMから情報を取得
   - チケットシステムを操作

3. **RAG（検索拡張生成）**
   - 社内ドキュメントを検索して回答
   - ナレッジベースの活用

### コード例：エージェントの呼び出し

```python
import boto3

bedrock_agent = boto3.client('bedrock-agent-runtime', region_name='us-west-2')

def invoke_agent(prompt: str, session_id: str, agent_id: str) -> str:
    """
    Bedrockエージェントを呼び出す
    """
    response = bedrock_agent.invoke_agent(
        agentId=agent_id,
        agentAliasId='TSTALIASID',
        sessionId=session_id,
        inputText=prompt
    )

    # ストリーミングレスポンスを処理
    result = ""
    for event in response['completion']:
        if 'chunk' in event:
            result += event['chunk']['bytes'].decode()

    return result
```

### エージェントの設定（AWS Console）

1. Bedrockコンソールで「エージェント」を作成
2. 使用するモデルを選択（Claude 3.5 Sonnetなど）
3. 「アクショングループ」でツールを定義
4. 「ナレッジベース」で検索対象を設定
5. エイリアスを作成してデプロイ

## 比較表で選ぼう

### 機能比較

| 項目 | Runtime API | Agents API |
|------|-------------|------------|
| セットアップ | 簡単（数行） | やや複雑（Console操作） |
| カスタマイズ | 高い（全て自前） | 中程度（設定ベース） |
| 外部ツール連携 | 自前実装 | 組み込み機能 |
| RAG | 自前実装 | 組み込み機能 |
| コスト | 低め | 高め（エージェント課金） |
| 予測可能性 | 高い | 低い（AIが判断） |

### コスト比較（月間1000リクエストの場合）

```
Runtime API:
  入力トークン: 100万 × $0.003 = $3.00
  出力トークン: 50万 × $0.015 = $7.50
  合計: $10.50

Agents API:
  エージェント呼び出し: 1000 × $0.05 = $50.00
  + モデル使用料（内部）
  合計: $60〜100程度
```

### 判断フローチャート

```
質問に答えるだけ？
  ├─ Yes → Runtime API
  └─ No
        ↓
外部データの検索が必要？
  ├─ No → Runtime API
  └─ Yes
        ↓
検索ロジックは複雑？
  ├─ No → Runtime API + 自前実装
  └─ Yes → Agents API
```

## 本プロジェクトでの選択

### Runtime APIを選んだ理由

製造業向け画像分析アプリでは、**Runtime API**を選択しました。理由は以下の通りです。

1. **画像分析がメイン**
   - ユーザーが画像をアップロード
   - AIがその画像を分析
   - 外部ツール不要

2. **会話履歴は自前で管理**
   - DynamoDBに保存
   - 直近5件を次のリクエストに含める
   - シンプルな実装で十分

3. **コスト効率**
   - エージェント課金なし
   - 必要な分だけ使う

### 実装のポイント

```python
# backend/services/bedrock_agent_invoker.py

def invoke_agent(
    session_id: str,
    input_text: str,
    system_prompt: str,
    image_base64_list: list[str] | None = None,
    conversation_history: list[dict] | None = None,
) -> Generator[dict, None, None]:
    """
    Runtime APIを使った「エージェント風」実装

    ポイント:
    - system_promptで「役割」を定義
    - conversation_historyで「記憶」を実現
    - image_base64_listで「視覚」を追加
    """

    # システムプロンプト（AIの「性格」）
    system = system_prompt

    # メッセージ履歴を構築
    messages = []

    # 過去の会話を追加（記憶）
    if conversation_history:
        for msg in conversation_history[-5:]:  # 直近5件
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

    # 今回のメッセージを追加
    user_content = []

    # 画像があれば追加（視覚）
    if image_base64_list:
        for img in image_base64_list:
            user_content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": img
                }
            })

    # テキストを追加
    user_content.append({
        "type": "text",
        "text": input_text
    })

    messages.append({
        "role": "user",
        "content": user_content
    })

    # Bedrockを呼び出し
    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "system": system,
        "messages": messages
    }

    # ストリーミングで応答を返す
    response = bedrock.invoke_model_with_response_stream(
        modelId="anthropic.claude-3-5-sonnet-20241022-v2:0",
        body=json.dumps(request_body)
    )

    for event in response['body']:
        chunk = event.get('chunk')
        if chunk:
            data = json.loads(chunk['bytes'].decode())
            yield data
```

## Claude 3.5 Sonnet v2のVision機能

### 画像分析の精度

Claude 3.5 Sonnet v2は、画像認識能力が非常に高いモデルです。

**得意なこと：**
- グラフの数値読み取り
- 表形式データの抽出
- 図面の構造理解
- 手書き文字の認識

**製造業での活用例：**
- 稼働実績グラフの分析
- 検査表の数値抽出
- 製造三角図の問題点指摘

### 画像送信のベストプラクティス

```python
# 推奨設定
MAX_IMAGES = 3        # 1リクエストあたり最大3枚
MAX_SIZE_MB = 4.5     # 安全マージンを含めたサイズ
MAX_DIMENSION = 8192  # 最大解像度

# 複数画像の場合
user_content = [
    {"type": "image", "source": {...}},  # 画像1
    {"type": "image", "source": {...}},  # 画像2
    {"type": "text", "text": "これらの画像を比較してください"}
]
```

## まとめ

### 選び方の基準

| 要件 | 選択 |
|-----|-----|
| シンプルなQ&A | Runtime API |
| 画像分析 | Runtime API |
| 外部DB検索が必須 | 検討が必要 |
| 複雑なワークフロー | Agents API |
| コスト重視 | Runtime API |
| 開発速度重視 | 要件による |

### 本プロジェクトの構成

```
ユーザー
  ↓
フロントエンド（React）
  ↓
API Gateway + Lambda
  ↓
Bedrock Runtime API（Claude 3.5 Sonnet v2）
  ↓
DynamoDB（会話履歴）
```

このシンプルな構成で、画像分析AIチャットを実現しています。

## 参考リンク

- [Amazon Bedrock Runtime API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeModel.html)
- [Amazon Bedrock Agents](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)
- [Claude Vision Documentation](https://docs.anthropic.com/claude/docs/vision)
