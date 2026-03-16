---
title: "文字が流れるように表示される仕組み"
emoji: "⚡"
type: "tech"
topics: ["React", "TypeScript", "NDJSON", "Streaming"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "NDJSON形式とKeepaliveを使ったリアルタイムストリーミング表示の実装。FastAPIとReactの連携方法。"
series: "製造業向けAI画像分析システムを作る"
seriesOrder: 8
coverImage: "/images/posts/workspace.jpg"
---


> **このシリーズ: 全10回**
> 1. [第1回: AIの回答を待ちきれない？30秒の壁を乗り越える方法](/posts/2026-03-16-image-analysis-01-lambda-streaming)
> 2. [第2回: 工場の図面をAIに読ませたい](/posts/2026-03-16-image-analysis-02-factory-image-analysis)
> 3. [第3回: Amazon BedrockでAIチャットを作る](/posts/2026-03-16-image-analysis-03-bedrock-api-guide)
> 4. [第4回: 「しばらくお待ちください」で終わらせない](/posts/2026-03-16-image-analysis-04-error-handling)
> 5. [第5回: AIの性格は設定ファイルで変える](/posts/2026-03-16-image-analysis-05-system-prompt-s3)
> 6. [第6回: 会話履歴を賢く管理する](/posts/2026-03-16-image-analysis-06-dynamodb-conversation)
> 7. [第7回: ログイン機能を30分で実装](/posts/2026-03-16-image-analysis-07-cognito-auth)
> 8. [第8回: 文字が流れるように表示される仕組み](/posts/2026-03-16-image-analysis-08-streaming-display) ← 今ここ
> 9. [第9回: React+TypeScriptで型安全なチャット画面を作る](/posts/2026-03-16-image-analysis-09-react-typescript-chat)
> 10. [第10回: サーバー代を半分にした話](/posts/2026-03-16-image-analysis-10-aws-cost-optimization)


ChatGPTのようなリアルタイム表示を実現

## はじめに

ChatGPTを使っていると、AIの回答が文字単位で流れてくるのを見たことがあるでしょう。

あの体験は、ただカッコいいだけではありません。**待ち時間のストレスを大幅に軽減する効果**があります。

- 全文が表示されるまで待つ：30秒が「長い」と感じる
- 文字が流れてくる：30秒でも「AIが考えている」と感じる

本記事では、このストリーミング表示を実現する技術「NDJSON」と、接続を維持する「Keepalive」の仕組みを解説します。

## ストリーミングの基本

### 従来の方式：全部できてから

一般的なWeb APIは、処理が完了してからレスポンスを返します。

```
[リクエスト] → [10秒処理] → [レスポンス]

ユーザーの体験：
「...」（10秒待つ）
「ドン！」（一気に表示）
```

これは「バッファリング」と呼ばれる方式で、短い処理なら問題ありませんが、AI分析のような長い処理では待ち時間が苦痛になります。

### ストリーミング方式：少しずつ

ストリーミングでは、生成された部分からすぐに送信します。

```
[リクエスト] → [処理しながら送信] → [処理しながら送信] → ...

ユーザーの体験：
「こ」「の」「グ」「ラ」「フ」「を」「分」「析」「す」「る」「と」...
（文字が流れてくる）
```

## NDJSONという形式

### JSONを1行ずつ送る

NDJSON（Newline Delimited JSON）は、JSONを1行ずつ送る形式です。

```
{"type":"text","content":"こんにちは"}
{"type":"text","content":"、画像を"}
{"type":"text","content":"分析します"}
{"type":"done"}
```

各行が独立したJSONオブジェクトになっています。

**なぜこの形式か：**

1. **パースが簡単** - 改行で分割すればOK
2. **部分読み取り可能** - 途中でも処理できる
3. **エラーに強い** - 1行が壊れても他は読める

### 実際のデータ例

AIからのストリーミングレスポンスは、こんな形で流れてきます。

```json
{"type":"ping"}
{"type":"text","content":"このグラフを分析すると、"}
{"type":"text","content":"以下の特徴が見られます。\n\n"}
{"type":"text","content":"1. **計画値との乖離**\n"}
{"type":"text","content":"   午前10時頃から実績値が計画を下回っています。"}
{"type":"ping"}
{"type":"text","content":"\n\n2. **異常な落ち込み**\n"}
{"type":"text","content":"   11時30分に急激な落ち込みがあります。"}
{"type":"done","usage":{"input_tokens":1500,"output_tokens":200}}
```

## Keepaliveの重要性

### 接続が切れる問題

ストリーミング中に、データが長時間流れないと接続が切れることがあります。

```
原因：
- ロードバランサーのタイムアウト
- プロキシサーバーの設定
- ブラウザの挙動
```

例えば、AIが複雑な分析をしていて15秒間何も出力しないと、間にあるサーバーが「この接続は死んだ」と判断して切ってしまうことがあります。

### 解決策：定期的に信号を送る

10秒ごとに「ping」を送ることで、接続が生きていることを示します。

```json
{"type":"text","content":"分析中..."}
{"type":"ping"}  ← 10秒後
{"type":"ping"}  ← 20秒後
{"type":"text","content":"結果が出ました！"}
{"type":"done"}
```

pingは内容を含まない「空の信号」なので、ユーザーには表示されません。

## バックエンド実装

### FastAPIでストリーミング

```python
# backend/streaming_app/main.py

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json
import asyncio
import threading
import queue

app = FastAPI()


async def stream_response(
    prompt: str,
    image_url: str | None = None,
    system_prompt: str = "",
):
    """
    Bedrockからの応答をストリーミングで返す
    """
    result_queue = queue.Queue()
    error_holder = [None]

    # 別スレッドでBedrock呼び出し（ブロッキング処理）
    def invoke_in_thread():
        try:
            for chunk in invoke_bedrock_streaming(
                prompt=prompt,
                image_url=image_url,
                system_prompt=system_prompt,
            ):
                result_queue.put(chunk)
        except Exception as e:
            error_holder[0] = e
        finally:
            result_queue.put(None)  # 終了シグナル

    thread = threading.Thread(target=invoke_in_thread)
    thread.start()

    # Keepalive用のタイマー
    last_send_time = asyncio.get_event_loop().time()
    KEEPALIVE_INTERVAL = 10  # 10秒

    while True:
        current_time = asyncio.get_event_loop().time()

        # キューからデータを取得（非ブロッキング）
        try:
            chunk = result_queue.get_nowait()

            if chunk is None:
                # 終了
                if error_holder[0]:
                    yield json.dumps({
                        "type": "error",
                        "message": str(error_holder[0])
                    }) + "\n"
                else:
                    yield json.dumps({"type": "done"}) + "\n"
                break

            # テキストチャンクを送信
            yield json.dumps({
                "type": "text",
                "content": chunk
            }) + "\n"
            last_send_time = current_time

        except queue.Empty:
            # キューが空の場合

            # Keepaliveが必要か確認
            if current_time - last_send_time >= KEEPALIVE_INTERVAL:
                yield json.dumps({"type": "ping"}) + "\n"
                last_send_time = current_time

            # 少し待つ
            await asyncio.sleep(0.1)


@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    """
    画像分析エンドポイント
    """
    return StreamingResponse(
        stream_response(
            prompt=request.prompt,
            image_url=request.image_url,
            system_prompt=request.system_prompt,
        ),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Nginx対策
        }
    )
```

### ポイント解説

**1. 別スレッドでBedrock呼び出し**

```python
thread = threading.Thread(target=invoke_in_thread)
```

Bedrockの呼び出しはブロッキング処理です。メインスレッドで実行すると、Keepaliveが送れなくなります。別スレッドで実行することで、メインスレッドはKeepaliveを送り続けられます。

**2. Queueで結果を受け渡し**

```python
result_queue.put(chunk)  # スレッドから
chunk = result_queue.get_nowait()  # メインから
```

スレッド間でデータを安全にやり取りするため、Queueを使います。

**3. 非ブロッキングで待つ**

```python
await asyncio.sleep(0.1)
```

ビジーループ（100%CPU使用）を避けるため、少し待ちます。

## フロントエンド実装

### ReadableStreamで受け取る

```typescript
// frontend/src/services/streamingClient.ts

type StreamChunk = {
  type: 'text' | 'ping' | 'done' | 'error';
  content?: string;
  message?: string;
};

export async function fetchStreaming(
  url: string,
  body: object,
  onChunk: (chunk: StreamChunk) => void,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getToken()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('ReadableStream not supported');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    // 受信データをバッファに追加
    buffer += decoder.decode(value, { stream: true });

    // 改行で分割してパース
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';  // 最後の不完全な行は保持

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const chunk: StreamChunk = JSON.parse(line);
        onChunk(chunk);
      } catch (e) {
        console.warn('Failed to parse:', line);
      }
    }
  }
}
```

### UIへの反映

```typescript
// frontend/src/components/ChatInterface.tsx

import { useState } from 'react';
import { fetchStreaming } from '../services/streamingClient';

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (prompt: string, imageUrl?: string) => {
    setIsLoading(true);
    setCurrentResponse('');

    // ユーザーメッセージを追加
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: prompt, imageUrl }
    ]);

    try {
      await fetchStreaming(
        '/api/analyze',
        { prompt, imageUrl },
        (chunk) => {
          switch (chunk.type) {
            case 'text':
              // 文字を追加していく
              setCurrentResponse((prev) => prev + (chunk.content || ''));
              break;

            case 'ping':
              // Keepaliveは無視
              break;

            case 'done':
              // 完了：確定したメッセージとして追加
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: currentResponse }
              ]);
              setCurrentResponse('');
              break;

            case 'error':
              // エラー表示
              alert(chunk.message || 'エラーが発生しました');
              break;
          }
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* メッセージ一覧 */}
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}

      {/* ストリーミング中の表示 */}
      {currentResponse && (
        <MessageBubble
          message={{ role: 'assistant', content: currentResponse }}
          isStreaming
        />
      )}

      {/* 入力欄 */}
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
```

### スクロール位置の調整

新しい文字が追加されたら、自動でスクロールします。

```typescript
// frontend/src/components/MessageList.tsx

import { useRef, useEffect } from 'react';

export function MessageList({ messages, streamingContent }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // メッセージ追加時にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="overflow-y-auto">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}

      {streamingContent && (
        <MessageBubble
          message={{ role: 'assistant', content: streamingContent }}
          isStreaming
        />
      )}

      {/* スクロール位置のアンカー */}
      <div ref={bottomRef} />
    </div>
  );
}
```

## トラブルシューティング

### 文字が一気に来る

**原因：** バッファリングが有効になっている

**解決策：**

```python
# バックエンド側
headers={
    "X-Accel-Buffering": "no",  # Nginx
    "Cache-Control": "no-cache",
}
```

```typescript
// フロントエンド側：fetchオプション確認
fetch(url, {
  // cache: 'no-store' を追加
  cache: 'no-store',
  // ...
})
```

### 途中で止まる

**原因：** Keepaliveが送られていない

**解決策：** Keepalive間隔を確認（10秒推奨）

```python
KEEPALIVE_INTERVAL = 10  # 10秒以下に設定
```

### 文字化けする

**原因：** マルチバイト文字が途中で切れている

**解決策：** TextDecoderで`stream: true`を指定

```typescript
const decoder = new TextDecoder();
buffer += decoder.decode(value, { stream: true });  // ← これが重要
```

## まとめ

### ストリーミングの効果

| 観点 | 従来方式 | ストリーミング |
|-----|---------|--------------|
| 待ち時間の体感 | 長い | 短い |
| 処理の可視化 | 不可 | 可能 |
| 中断の容易さ | 難しい | 簡単 |
| 実装の複雑さ | 低 | 中 |

### 実装チェックリスト

**バックエンド：**
- [ ] NDJSON形式でのレスポンス
- [ ] Keepalive（10秒間隔）
- [ ] 別スレッドでのBedrock呼び出し
- [ ] バッファリング無効化ヘッダー

**フロントエンド：**
- [ ] ReadableStreamでの受信
- [ ] 改行での分割とパース
- [ ] ping（Keepalive）の無視
- [ ] UIへのリアルタイム反映
- [ ] 自動スクロール

## 参考リンク

- [NDJSON Specification](http://ndjson.org/)
- [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
- [FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/)
