---
title: "工場の図面をAIに読ませたい"
emoji: "🏭"
type: "tech"
topics: ["AWS", "Bedrock", "Python", "Pillow"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "製造業で使われるTIFF・PDF・BMPをAIで分析するための変換処理。tiff.js、Pillow、PyMuPDFの実装例。"
series: "製造業向けAI画像分析システムを作る"
seriesOrder: 2
coverImage: "/images/posts/coding-screen.jpg"
---


> **このシリーズ: 全10回**
> 1. [第1回: AIの回答を待ちきれない？30秒の壁を乗り越える方法](/posts/2026-03-16-image-analysis-01-lambda-streaming)
> 2. [第2回: 工場の図面をAIに読ませたい](/posts/2026-03-16-image-analysis-02-factory-image-analysis) ← 今ここ
> 3. [第3回: Amazon BedrockでAIチャットを作る](/posts/2026-03-16-image-analysis-03-bedrock-api-guide)
> 4. [第4回: 「しばらくお待ちください」で終わらせない](/posts/2026-03-16-image-analysis-04-error-handling)
> 5. [第5回: AIの性格は設定ファイルで変える](/posts/2026-03-16-image-analysis-05-system-prompt-s3)
> 6. [第6回: 会話履歴を賢く管理する](/posts/2026-03-16-image-analysis-06-dynamodb-conversation)
> 7. [第7回: ログイン機能を30分で実装](/posts/2026-03-16-image-analysis-07-cognito-auth)
> 8. [第8回: 文字が流れるように表示される仕組み](/posts/2026-03-16-image-analysis-08-streaming-display)
> 9. [第9回: React+TypeScriptで型安全なチャット画面を作る](/posts/2026-03-16-image-analysis-09-react-typescript-chat)
> 10. [第10回: サーバー代を半分にした話](/posts/2026-03-16-image-analysis-10-aws-cost-optimization)


高解像度TIFF・PDFをAIで分析する方法

## はじめに

製造業の現場では、高品質な画像形式が多く使われています。設計図面はTIFF、スキャンした検査表はPDF、レガシーシステムからのエクスポートはBMP。

「これらの画像をAIに分析させたい」というニーズは多いのですが、実は簡単ではありません。本記事では、製造業でよく使われる画像形式をAIで扱うための実践的な方法を解説します。

## 製造業でよく使う画像形式

### TIFF：高品質だけど扱いにくい

TIFF（Tagged Image File Format）は、製造業で長年愛用されている画像形式です。

**選ばれる理由：**
- 圧縮しても画質が劣化しない（可逆圧縮）
- 高解像度に対応（8000px以上も可能）
- 複数ページを1ファイルにまとめられる

**困る点：**
- ブラウザが直接表示できない
- ファイルサイズが大きい
- 一般的なWebサービスが対応していない

### PDF：ドキュメントの王様

スキャンした書類は、ほぼPDFになります。

**よくある場面：**
- 紙の検査表をスキャン
- 図面をPDF化して保存
- 報告書に画像を埋め込み

**AIで扱う難しさ：**
- 「ドキュメント」であり「画像」ではない
- ページごとに分割が必要
- テキストと画像が混在

### BMP：レガシーだけど現役

古いシステムとの連携では、BMPファイルが登場することがあります。

**特徴：**
- 無圧縮で画質が完全
- 古いWindowsソフトとの互換性
- ファイルサイズは巨大

## ブラウザ側の工夫：プレビューを表示する

ユーザーがTIFFファイルをアップロードしたとき、「プレビューが見えない」のは不便です。tiff.jsライブラリを使って、ブラウザ上でプレビューを表示しましょう。

### tiff.jsライブラリの活用

```bash
npm install tiff.js
```

### 実装例：TIFFをブラウザで表示

```typescript
// frontend/src/utils/imageConverter.ts

export async function convertTiffToDataUrl(file: File): Promise<string> {
  // ファイルをArrayBufferとして読み込む
  const buffer = await file.arrayBuffer();

  // tiff.jsでデコード
  const tiff = new window.Tiff({ buffer: new Uint8Array(buffer) });

  // 最初のページをCanvasに描画
  const canvas = tiff.toCanvas();

  // Data URLに変換（PNG形式）
  return canvas.toDataURL('image/png', 1.0);
}
```

### 使い方

```typescript
// frontend/src/components/ImageUpload.tsx

const handleFileChange = async (file: File) => {
  let previewUrl: string;

  if (file.type === 'image/tiff') {
    // TIFFはブラウザで変換してプレビュー
    previewUrl = await convertTiffToDataUrl(file);
  } else {
    // その他の形式はそのまま
    previewUrl = URL.createObjectURL(file);
  }

  setPreview(previewUrl);
};
```

### 注意点：メモリ使用量

高解像度のTIFFファイル（50MB以上）を処理すると、ブラウザのメモリを大量に消費します。以下の対策を検討してください。

- 処理前にファイルサイズをチェック
- 変換に失敗したらプレースホルダーを表示
- Web Workerで別スレッド処理

## サーバー側の工夫：AIに渡す準備

ブラウザでプレビューを表示しても、AIに渡すためにはサーバー側での変換が必要です。

### Lambda Layerとは

Lambda Layerは、複数のLambda関数で共有できる「共通の道具箱」です。

画像処理ライブラリ（Pillow）をLayerとして用意しておけば、どの関数からでも使えます。

```
Lambda Layer（道具箱）
├── Pillow（画像処理）
└── PyMuPDF（PDF処理）

↓ 共有

Lambda関数A（画像アップロード）
Lambda関数B（画像分析）
Lambda関数C（レポート生成）
```

### Pillowライブラリで変換

Pythonの画像処理ライブラリ「Pillow」は、多くの形式に対応しています。

**対応フォーマット：**
- TIFF（マルチページ対応）
- BMP
- JPEG、PNG、GIF、WebP

**注意：** Lambda上で動かすには、Linux用のバイナリが必要です。Windows/MacのPillowはLambdaで動きません。

### 実装例：変換処理

```python
# backend/services/image_converter.py

from PIL import Image
import io
import base64

# 最大解像度（Bedrockの推奨値）
MAX_DIMENSION = 8192

def convert_to_png(image_bytes: bytes, content_type: str) -> list[str]:
    """
    各種画像形式をPNG（base64）に変換

    Args:
        image_bytes: 画像のバイナリデータ
        content_type: MIMEタイプ

    Returns:
        base64エンコードされたPNG画像のリスト
    """
    results = []

    if content_type == 'application/pdf':
        # PDFは専用処理
        results = convert_pdf_pages(image_bytes)
    else:
        # TIFF、BMP、その他
        img = Image.open(io.BytesIO(image_bytes))

        # マルチページTIFFの処理
        for page_num in range(getattr(img, 'n_frames', 1)):
            if hasattr(img, 'seek'):
                img.seek(page_num)

            # RGBに変換（透過チャンネル対応）
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # リサイズ（必要な場合）
            img = resize_if_needed(img)

            # PNG形式でbase64エンコード
            buffer = io.BytesIO()
            img.save(buffer, format='PNG', optimize=True)
            base64_data = base64.b64encode(buffer.getvalue()).decode()

            results.append(base64_data)

    return results


def resize_if_needed(img: Image.Image) -> Image.Image:
    """
    大きすぎる画像をリサイズ
    """
    width, height = img.size

    if width <= MAX_DIMENSION and height <= MAX_DIMENSION:
        return img

    # アスペクト比を維持してリサイズ
    ratio = min(MAX_DIMENSION / width, MAX_DIMENSION / height)
    new_size = (int(width * ratio), int(height * ratio))

    return img.resize(new_size, Image.Resampling.LANCZOS)
```

### エラーハンドリング

画像処理は失敗しやすいポイントです。適切なエラーハンドリングを入れましょう。

```python
def safe_convert(image_bytes: bytes, content_type: str) -> list[str]:
    """
    エラーに強い変換処理
    """
    try:
        return convert_to_png(image_bytes, content_type)
    except Exception as e:
        logger.warning(f"画像変換に失敗: {e}")
        # 空のリストを返して処理を継続
        # （画像なしでもテキストで回答可能）
        return []
```

## 画像サイズの壁：5MBの制限

### なぜ制限があるのか

Amazon Bedrockには、1リクエストあたりの画像サイズ制限があります。

- **base64エンコード後のサイズ**: 最大5MB
- **推奨解像度**: 8192 x 8192ピクセル以下

高解像度のTIFFファイルは、この制限を簡単に超えてしまいます。

### 解決策：リサイズと圧縮

品質を保ちながら制限内に収める方法を紹介します。

```python
def compress_for_bedrock(img: Image.Image, max_size_mb: float = 4.5) -> str:
    """
    Bedrockの制限に合わせて圧縮

    Args:
        img: PIL Image
        max_size_mb: 最大サイズ（MB）

    Returns:
        base64エンコードされた画像
    """
    max_size_bytes = int(max_size_mb * 1024 * 1024)

    # まずPNGで試す（高品質）
    buffer = io.BytesIO()
    img.save(buffer, format='PNG', optimize=True)

    if buffer.tell() <= max_size_bytes:
        return base64.b64encode(buffer.getvalue()).decode()

    # PNGでダメならJPEGで圧縮
    quality = 95
    while quality >= 50:
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=quality)

        if buffer.tell() <= max_size_bytes:
            return base64.b64encode(buffer.getvalue()).decode()

        quality -= 5

    # それでもダメならリサイズ
    ratio = 0.9
    while ratio >= 0.3:
        new_size = (int(img.width * ratio), int(img.height * ratio))
        resized = img.resize(new_size, Image.Resampling.LANCZOS)

        buffer = io.BytesIO()
        resized.save(buffer, format='JPEG', quality=85)

        if buffer.tell() <= max_size_bytes:
            return base64.b64encode(buffer.getvalue()).decode()

        ratio -= 0.1

    raise ValueError("画像を制限サイズ内に収められません")
```

## Lambda Layerの作成方法

### Linux用Pillowのダウンロード

```python
# layers/download-pillow.py

import subprocess
import os

# Linux用のwheelをダウンロード
packages = [
    'Pillow',
    'PyMuPDF',  # PDF処理用
]

for package in packages:
    subprocess.run([
        'pip', 'download',
        '--platform', 'manylinux2014_x86_64',
        '--python-version', '312',
        '--only-binary', ':all:',
        '-d', './wheels',
        package
    ])
```

### CDKでのLayer設定

```typescript
// infrastructure/lib/image-analysis-stack.ts

const pillowLayer = new lambda.LayerVersion(this, 'PillowLayer', {
  code: lambda.Code.fromAsset('layers/pillow'),
  compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
  description: 'Pillow and PyMuPDF for image processing',
});

const imageHandler = new lambda.Function(this, 'ImageHandler', {
  runtime: lambda.Runtime.PYTHON_3_12,
  handler: 'handler.main',
  code: lambda.Code.fromAsset('backend'),
  layers: [pillowLayer],  // Layerを追加
  memorySize: 1024,  // 画像処理にはメモリが必要
  timeout: cdk.Duration.seconds(30),
});
```

## まとめ

### 対応フォーマット一覧

| 形式 | ブラウザプレビュー | サーバー変換 | 備考 |
|-----|------------------|-------------|------|
| JPEG | ネイティブ対応 | 変換不要 | - |
| PNG | ネイティブ対応 | 変換不要 | - |
| GIF | ネイティブ対応 | 変換不要 | - |
| WebP | ネイティブ対応 | 変換不要 | - |
| TIFF | tiff.js使用 | Pillow使用 | マルチページ対応 |
| BMP | ネイティブ対応 | Pillow使用 | - |
| PDF | 要変換 | PyMuPDF使用 | ページ分割 |

### トラブルシューティング

| 問題 | 原因 | 解決策 |
|-----|-----|-------|
| プレビューが表示されない | tiff.jsの読み込み失敗 | CDN読み込みを確認 |
| Lambdaでエラー | Windows用Pillow | Linux用に差し替え |
| 分析結果が悪い | 解像度が低すぎる | リサイズ設定を確認 |
| タイムアウト | ファイルが大きすぎる | 事前圧縮を検討 |

## 参考リンク

- [Pillow Documentation](https://pillow.readthedocs.io/)
- [tiff.js GitHub](https://github.com/nicholasbishop/tiff.js)
- [Amazon Bedrock Image Requirements](https://docs.aws.amazon.com/bedrock/)
