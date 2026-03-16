---
title: "「しばらくお待ちください」で終わらせない"
emoji: "🔧"
type: "tech"
topics: ["AWS", "Bedrock", "Python", "ErrorHandling"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "BedrockのThrottlingException・タイムアウトへのリトライ処理。ジッター付き指数バックオフとユーザーへの伝え方。"
series: "製造業向けAI画像分析システムを作る"
seriesOrder: 4
coverImage: "/images/posts/workspace.jpg"
---

# 「しばらくお待ちください」で終わらせない

> **このシリーズ: 全10回**
> 1. [第1回: AIの回答を待ちきれない？30秒の壁を乗り越える方法](/posts/2026-03-16-image-analysis-01-lambda-streaming)
> 2. [第2回: 工場の図面をAIに読ませたい](/posts/2026-03-16-image-analysis-02-factory-image-analysis)
> 3. [第3回: Amazon BedrockでAIチャットを作る](/posts/2026-03-16-image-analysis-03-bedrock-api-guide)
> 4. [第4回: 「しばらくお待ちください」で終わらせない](/posts/2026-03-16-image-analysis-04-error-handling) ← 今ここ
> 5. [第5回: AIの性格は設定ファイルで変える](/posts/2026-03-16-image-analysis-05-system-prompt-s3)
> 6. [第6回: 会話履歴を賢く管理する](/posts/2026-03-16-image-analysis-06-dynamodb-conversation)
> 7. [第7回: ログイン機能を30分で実装](/posts/2026-03-16-image-analysis-07-cognito-auth)
> 8. [第8回: 文字が流れるように表示される仕組み](/posts/2026-03-16-image-analysis-08-streaming-display)
> 9. [第9回: React+TypeScriptで型安全なチャット画面を作る](/posts/2026-03-16-image-analysis-09-react-typescript-chat)
> 10. [第10回: サーバー代を半分にした話](/posts/2026-03-16-image-analysis-10-aws-cost-optimization)


AIエラー対策とリトライの基本

## はじめに

AIサービスを使ったアプリケーションを公開すると、必ずエラーに遭遇します。

「しばらくお待ちください」「エラーが発生しました」

こんなメッセージを出して終わりにしていませんか？ユーザーは何が起きたか分からず、不安になります。

本記事では、Amazon Bedrockでよく発生するエラーの対処法と、ユーザーへの適切な伝え方を解説します。

## よくあるエラー3つ

### 1. 混雑エラー（ThrottlingException）

Amazon Bedrockには、リクエスト数の制限があります。この制限を超えると「混雑エラー」が発生します。

```python
botocore.exceptions.ClientError: An error occurred (ThrottlingException)
when calling the InvokeModelWithResponseStream operation:
Too many requests, please wait before trying again.
```

**発生する状況：**
- 短時間に多くのリクエストを送った
- 同時に複数のユーザーがアクセスした
- 大きなトークン数を消費した

### 2. タイムアウトエラー（ReadTimeoutError）

Bedrockからの応答が一定時間内に返ってこない場合に発生します。

```python
botocore.exceptions.ReadTimeoutError:
Read timeout on endpoint URL:
"https://bedrock-runtime.us-west-2.amazonaws.com/..."
```

**発生する状況：**
- 大きな画像を送信した
- 複雑な質問をした
- Bedrockサービスが混雑している

### 3. モデルタイムアウト（ModelTimeoutException）

AIモデル自体の処理が時間切れになった場合に発生します。

```python
botocore.exceptions.ClientError: An error occurred (ModelTimeoutException)
when calling the InvokeModelWithResponseStream operation:
The model took too long to respond.
```

**発生する状況：**
- 非常に複雑な分析を要求した
- 大量の入力データを送った
- モデルの処理能力を超えた

## リトライの考え方

### すぐにリトライしてはダメな理由

エラーが発生したとき、すぐにリトライしたくなります。しかし、これは逆効果です。

```
❌ 悪い例：即座にリトライ

[エラー発生] → [即リトライ] → [またエラー] → [即リトライ] → ...

サーバーがさらに混む → 全員がエラーになる
```

混雑が原因でエラーになったのに、すぐにリトライすると混雑がさらに悪化します。

### 指数バックオフとは

「指数バックオフ」は、リトライの間隔を徐々に広げる戦略です。

```
✅ 良い例：指数バックオフ

[エラー発生] → 1秒待つ → [リトライ]
                          ↓
                      [またエラー] → 2秒待つ → [リトライ]
                                              ↓
                                          [またエラー] → 4秒待つ → [リトライ]
                                                                  ↓
                                                              [成功！]
```

待ち時間を「1秒 → 2秒 → 4秒 → 8秒」と倍々に増やしていきます。

**料理店に例えると：**
- 混んでる店に入れなかった
- 5分後にまた行く → まだ混んでる
- 10分後にまた行く → まだ混んでる
- 20分後にまた行く → 入れた！

少し待てば、他のお客さんが帰って空きができます。

### ジッターを加える理由

「ジッター」は、待ち時間にランダムな幅を持たせることです。

```
❌ ジッターなし：
ユーザーA: 1秒待ち → 2秒待ち → 4秒待ち
ユーザーB: 1秒待ち → 2秒待ち → 4秒待ち
ユーザーC: 1秒待ち → 2秒待ち → 4秒待ち

→ 全員が同じタイミングでリトライ → また混む

✅ ジッターあり：
ユーザーA: 0.8秒待ち → 2.3秒待ち → 3.5秒待ち
ユーザーB: 1.2秒待ち → 1.7秒待ち → 4.8秒待ち
ユーザーC: 0.9秒待ち → 2.5秒待ち → 3.9秒待ち

→ リトライが分散 → サーバー負荷が平準化
```

## 実装してみよう

### Pythonでのリトライ処理

```python
# backend/services/bedrock_invoker.py

import time
import random
import logging
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# 設定値
MAX_RETRIES = 3          # 最大リトライ回数
INITIAL_DELAY = 1.0      # 初期待ち時間（秒）
MAX_DELAY = 30.0         # 最大待ち時間（秒）
JITTER_FACTOR = 0.5      # ジッターの幅（±50%）


def calculate_backoff(attempt: int) -> float:
    """
    ジッター付き指数バックオフを計算

    Args:
        attempt: 試行回数（0から始まる）

    Returns:
        待機時間（秒）
    """
    # 指数バックオフ: 1秒 → 2秒 → 4秒 → 8秒...
    delay = INITIAL_DELAY * (2 ** attempt)

    # 最大値でカット
    delay = min(delay, MAX_DELAY)

    # ジッターを追加（±50%のランダム幅）
    jitter = delay * JITTER_FACTOR * (2 * random.random() - 1)
    delay = max(0, delay + jitter)

    return delay


def invoke_with_retry(request_body: dict) -> dict:
    """
    リトライ付きでBedrockを呼び出す
    """
    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            logger.info(f"Bedrock呼び出し: 試行 {attempt + 1}/{MAX_RETRIES}")

            response = bedrock.invoke_model(
                modelId="anthropic.claude-3-5-sonnet-20241022-v2:0",
                body=json.dumps(request_body)
            )

            return json.loads(response['body'].read())

        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            last_error = e

            # リトライ可能なエラーかチェック
            if error_code in ['ThrottlingException', 'ModelTimeoutException']:
                if attempt < MAX_RETRIES - 1:
                    delay = calculate_backoff(attempt)
                    logger.warning(f"{error_code}: {delay:.1f}秒待機してリトライ")
                    time.sleep(delay)
                    continue

            # リトライ不可能なエラーは即座に終了
            raise

        except Exception as e:
            error_str = str(e)
            last_error = e

            # タイムアウト系のエラー
            if 'ReadTimeoutError' in error_str or 'timed out' in error_str.lower():
                if attempt < MAX_RETRIES - 1:
                    delay = calculate_backoff(attempt)
                    logger.warning(f"タイムアウト: {delay:.1f}秒待機してリトライ")
                    time.sleep(delay)
                    continue

            raise

    # 全リトライ失敗
    raise last_error
```

### 設定値の決め方

| 設定 | 推奨値 | 理由 |
|-----|-------|-----|
| MAX_RETRIES | 3 | 3回で解決しないなら別の問題 |
| INITIAL_DELAY | 1秒 | 短すぎると効果薄、長すぎるとUX悪化 |
| MAX_DELAY | 30秒 | これ以上待たせるのはユーザー体験が悪い |
| JITTER_FACTOR | 0.5 | ±50%で十分な分散効果 |

## ユーザーへの伝え方

### 技術エラーをそのまま出さない

```
❌ 悪い例：
"ThrottlingException: Too many requests"

ユーザーの反応：「何それ？壊れた？」
```

```
✅ 良い例：
"現在アクセスが集中しています。
しばらく待ってから再度お試しください。"

ユーザーの反応：「混んでるのね、後で試そう」
```

### エラーメッセージの設計

良いエラーメッセージには3つの要素があります。

1. **何が起きたか**（状況の説明）
2. **どうすればいいか**（次のアクション）
3. **いつ試せばいいか**（時間の目安）

```python
# backend/services/error_messages.py

ERROR_MESSAGES = {
    'ThrottlingException': {
        'title': 'アクセス集中',
        'message': '現在アクセスが集中しています。',
        'action': '1〜2分待ってから再度お試しください。',
    },
    'ModelTimeoutException': {
        'title': '処理タイムアウト',
        'message': '分析に時間がかかりすぎました。',
        'action': '画像サイズを小さくするか、質問を短くしてお試しください。',
    },
    'ReadTimeoutError': {
        'title': '応答なし',
        'message': 'サーバーからの応答がありませんでした。',
        'action': 'しばらく待ってから再度お試しください。',
    },
    'ValidationException': {
        'title': '入力エラー',
        'message': 'リクエストの形式に問題があります。',
        'action': '画像形式（JPEG, PNG）を確認してください。',
    },
}


def get_user_message(error: Exception) -> dict:
    """
    エラーをユーザー向けメッセージに変換
    """
    error_str = str(error)

    for error_type, messages in ERROR_MESSAGES.items():
        if error_type in error_str:
            return messages

    # 不明なエラー
    logger.error(f"予期せぬエラー: {error_str}")
    return {
        'title': 'エラー',
        'message': '予期せぬエラーが発生しました。',
        'action': '問題が続く場合は管理者にお問い合わせください。',
    }
```

### フロントエンドでの表示

```typescript
// frontend/src/components/ErrorMessage.tsx

type ErrorInfo = {
  title: string;
  message: string;
  action: string;
};

function ErrorMessage({ error }: { error: ErrorInfo }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <h3 className="text-red-800 font-bold">
        {error.title}
      </h3>
      <p className="text-red-700 mt-1">
        {error.message}
      </p>
      <p className="text-red-600 mt-2 text-sm">
        {error.action}
      </p>
    </div>
  );
}
```

## 画像処理が失敗したとき

### 全部失敗にしない

画像の変換やダウンロードが失敗しても、テキストだけで回答を続けられる場合があります。

```python
def process_request(
    prompt: str,
    image_url: str | None = None
) -> Generator[dict, None, None]:
    """
    画像エラー時もグレースフルに続行
    """
    image_contents = []

    if image_url:
        try:
            # 画像の取得と変換
            image_base64 = fetch_and_convert_image(image_url)
            image_contents.append({
                'type': 'image',
                'source': {
                    'type': 'base64',
                    'media_type': 'image/png',
                    'data': image_base64,
                },
            })
        except Exception as e:
            logger.warning(f"画像処理失敗: {e}")

            # 警告を返すが、処理は続行
            yield {
                'type': 'warning',
                'message': '画像の読み込みに失敗しました。テキストのみで回答します。',
            }

    # 画像なしでも処理を続行
    for chunk in invoke_bedrock(prompt, image_contents):
        yield chunk
```

### フロントエンドでの警告表示

```typescript
// frontend/src/components/ChatInterface.tsx

function handleStreamChunk(chunk: StreamChunk) {
  if (chunk.type === 'warning') {
    // 警告を表示（黄色い背景など）
    showWarning(chunk.message);
  } else if (chunk.type === 'text') {
    // テキストを追加
    appendText(chunk.content);
  }
}
```

## まとめ

### エラー対策の3原則

1. **すぐにリトライしない**
   - 指数バックオフで待ち時間を増やす
   - ジッターでタイミングを分散

2. **技術用語を見せない**
   - ユーザーが理解できる言葉で伝える
   - 次のアクションを明示

3. **完全に止めない**
   - 一部が失敗しても続行できないか検討
   - 警告を出しながら処理継続

### チェックリスト

- [ ] ThrottlingExceptionのリトライ処理
- [ ] ModelTimeoutExceptionのリトライ処理
- [ ] ReadTimeoutErrorのリトライ処理
- [ ] ジッター付き指数バックオフの実装
- [ ] ユーザー向けエラーメッセージの設計
- [ ] 画像エラー時のフォールバック処理
- [ ] エラーログの出力

## 参考リンク

- [Exponential Backoff And Jitter (AWS Blog)](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Amazon Bedrock Quotas](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas.html)
- [Error Handling in AWS](https://docs.aws.amazon.com/general/latest/gr/api-retries.html)
