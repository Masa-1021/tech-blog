---
title: "AIの回答を待ちきれない？30秒の壁を乗り越える方法"
emoji: "🚀"
type: "tech"
topics: ["AWS", "Lambda", "Bedrock", "Streaming"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "AWS LambdaのストリーミングとAPI Gateway Response Streamingで、AIの29秒タイムアウト制限を回避する方法を解説。"
series: "製造業向けAI画像分析システムを作る"
seriesOrder: 1
coverImage: "/images/posts/laptop-code.jpg"
---

# AIの回答を待ちきれない？30秒の壁を乗り越える方法

> **このシリーズ: 全10回**
> 1. [第1回: AIの回答を待ちきれない？30秒の壁を乗り越える方法](/posts/2026-03-16-image-analysis-01-lambda-streaming) ← 今ここ
> 2. [第2回: 工場の図面をAIに読ませたい](/posts/2026-03-16-image-analysis-02-factory-image-analysis)
> 3. [第3回: Amazon BedrockでAIチャットを作る](/posts/2026-03-16-image-analysis-03-bedrock-api-guide)
> 4. [第4回: 「しばらくお待ちください」で終わらせない](/posts/2026-03-16-image-analysis-04-error-handling)
> 5. [第5回: AIの性格は設定ファイルで変える](/posts/2026-03-16-image-analysis-05-system-prompt-s3)
> 6. [第6回: 会話履歴を賢く管理する](/posts/2026-03-16-image-analysis-06-dynamodb-conversation)
> 7. [第7回: ログイン機能を30分で実装](/posts/2026-03-16-image-analysis-07-cognito-auth)
> 8. [第8回: 文字が流れるように表示される仕組み](/posts/2026-03-16-image-analysis-08-streaming-display)
> 9. [第9回: React+TypeScriptで型安全なチャット画面を作る](/posts/2026-03-16-image-analysis-09-react-typescript-chat)
> 10. [第10回: サーバー代を半分にした話](/posts/2026-03-16-image-analysis-10-aws-cost-optimization)


AWS Lambda ストリーミングで実現するリアルタイム応答

## はじめに

ChatGPTを使ったことがある方なら、文字が少しずつ流れてくる体験をご存知でしょう。あの「AIが考えながら答えている」感覚は、ユーザー体験として非常に優れています。

しかし、AWSで同じような体験を作ろうとすると、ある壁にぶつかります。それが「30秒の壁」です。

本記事では、この壁の正体と、2025年に登場した新機能を使った解決方法を解説します。

## なぜ30秒で止まるのか

### API Gatewayの制限を知ろう

AWSでWebアプリケーションを作る場合、多くの人がAPI Gatewayを使います。これは、インターネットからのリクエストを受け付ける「受付窓口」のような存在です。

この受付窓口には、実は「待ち時間の上限」が設定されています。

```
ユーザー → API Gateway → Lambda → Bedrock（AI）
              ↑
        ここで29秒まで
```

API Gatewayは、バックエンドからの応答を**最大29秒**しか待ちません。それを超えると、処理が終わっていなくても「504 Gateway Timeout」というエラーを返してしまいます。

### AIの処理には時間がかかる

特に画像分析では、この29秒制限が大きな問題になります。

- 画像のダウンロード：1〜3秒
- 画像の変換処理：2〜5秒
- AIによる分析：10〜60秒
- レスポンスの生成：1〜5秒

合計すると、複雑な分析では29秒を軽く超えてしまいます。

### 従来の解決策とその限界

これまでの解決策は主に2つありました。

**1. Lambda Function URLを使う**

API Gatewayを経由せず、Lambdaに直接アクセスする方法です。タイムアウトは最大15分まで伸ばせますが、認証の仕組みを自分で作る必要があります。

**2. 非同期処理 + ポーリング**

処理を開始したらすぐに「受け付けました」と返し、結果は別途取りに行く方法です。実装が複雑になり、リアルタイム感もなくなります。

## 解決策：ストリーミングという発想

### 「全部できてから返す」から「少しずつ返す」へ

従来の方式を料理に例えると、「コース料理」のようなものです。全品揃ってから一気に提供します。

ストリーミングは「回転寿司」です。できたものから順番にお客さんの前に流れていきます。

```
従来方式（コース料理）：
[処理開始] -------- 29秒 -------- [全部完成] → 一括送信

ストリーミング方式（回転寿司）：
[処理開始] → 少し → 少し → 少し → 少し → [完了]
              ↓      ↓      ↓      ↓
           すぐ送信 すぐ送信 すぐ送信 すぐ送信
```

ストリーミングなら、最初の文字が生成された時点で送信が始まります。29秒の壁は「最初のレスポンスまでの時間」にしか影響しないため、実質的に制限を回避できます。

### 2025年11月の朗報：API Gatewayがストリーミング対応

これまで、API Gateway経由でストリーミングを実現するのは困難でした。しかし、2025年11月にAWSから待望の新機能が発表されました。

**API Gateway Response Streaming**

この機能により、API Gatewayを経由したままストリーミングが可能になりました。Cognito認証もそのまま使えるため、セキュリティを犠牲にする必要がありません。

## 実装してみよう

### 必要な材料

1. **Lambda Web Adapter** - LambdaでWebフレームワークを動かすための仕組み
2. **FastAPI** - Pythonの軽量Webフレームワーク
3. **API Gateway Response Streaming** - 新機能の設定

### ステップ1：Lambdaの準備

まず、FastAPIでストリーミングレスポンスを返すコードを書きます。

```python
# streaming_app/main.py
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

async def generate_stream():
    """AIからの応答を少しずつ返す"""
    # Bedrockからストリーミングで受け取る
    for chunk in invoke_bedrock_streaming(prompt):
        # NDJSON形式で1行ずつ送信
        yield json.dumps({"type": "text", "content": chunk}) + "\n"

    # 完了を通知
    yield json.dumps({"type": "done"}) + "\n"

@app.post("/analyze")
async def analyze():
    return StreamingResponse(
        generate_stream(),
        media_type="application/x-ndjson"
    )
```

### ステップ2：API Gatewayの設定

CDK（AWS Cloud Development Kit）で設定する場合、以下のように記述します。

```typescript
// infrastructure/lib/image-analysis-stack.ts

// ストリーミング用Lambda
const streamingFunction = new lambda.Function(this, 'StreamingFunction', {
  runtime: lambda.Runtime.PYTHON_3_12,
  handler: 'run.sh',  // Lambda Web Adapter用
  code: lambda.Code.fromAsset('backend/streaming_app'),
  timeout: cdk.Duration.minutes(15),
  environment: {
    AWS_LWA_INVOKE_MODE: 'response_stream',
  },
});

// API Gateway統合（ストリーミング有効）
const streamingIntegration = new apigateway.LambdaIntegration(
  streamingFunction,
  {
    // ストリーミングを有効化
    // 2025年11月以降の新機能
  }
);
```

### ステップ3：フロントエンドで受け取る

JavaScriptでストリーミングレスポンスを処理します。

```typescript
// frontend/src/services/apiClient.ts

async function fetchStreaming(url: string, body: object) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // 受け取ったデータを処理
    const text = decoder.decode(value);
    const lines = text.split('\n').filter(line => line);

    for (const line of lines) {
      const data = JSON.parse(line);
      if (data.type === 'text') {
        // UIに文字を追加
        appendMessage(data.content);
      }
    }
  }
}
```

## 動作確認

### テスト方法

1. フロントエンドで画像をアップロード
2. 分析ボタンをクリック
3. 文字が少しずつ表示されることを確認

### うまくいかないときのチェックリスト

| 症状 | 確認ポイント |
|-----|------------|
| 504エラーが出る | API Gatewayのストリーミング設定を確認 |
| 文字が一気に来る | Lambda Web Adapterの設定を確認 |
| 途中で止まる | Lambdaのタイムアウト設定を確認 |
| 認証エラー | Cognitoトークンが有効か確認 |

## まとめ

### この記事で学んだこと

1. **30秒の壁の正体** - API Gatewayの29秒タイムアウト制限
2. **ストリーミングの考え方** - 全部待たずに少しずつ返す
3. **新機能の活用** - API Gateway Response Streamingで実現

### 次のステップ

- [記事8: 文字が流れるように表示される仕組み](./08-ndjson-streaming-keepalive.md) - ストリーミングの詳細実装
- [記事4: エラー対策の基本](./04-bedrock-error-handling.md) - ストリーミング中のエラー処理

## 参考リンク

- [AWS Blog: API Gateway Response Streaming](https://aws.amazon.com/blogs/compute/)
- [Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter)
- [FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/)
