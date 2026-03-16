---
title: "ログイン機能を30分で実装"
emoji: "🔐"
type: "tech"
topics: ["AWS", "Cognito", "React", "Auth"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "Amazon Cognitoで認証機能を30分で実装。User Pool・App Client・JWT・Cognito Authorizerの設定方法。"
series: "製造業向けAI画像分析システムを作る"
seriesOrder: 7
coverImage: "/images/posts/code-editor.jpg"
---


> **このシリーズ: 全10回**
> 1. [第1回: AIの回答を待ちきれない？30秒の壁を乗り越える方法](/posts/2026-03-16-image-analysis-01-lambda-streaming)
> 2. [第2回: 工場の図面をAIに読ませたい](/posts/2026-03-16-image-analysis-02-factory-image-analysis)
> 3. [第3回: Amazon BedrockでAIチャットを作る](/posts/2026-03-16-image-analysis-03-bedrock-api-guide)
> 4. [第4回: 「しばらくお待ちください」で終わらせない](/posts/2026-03-16-image-analysis-04-error-handling)
> 5. [第5回: AIの性格は設定ファイルで変える](/posts/2026-03-16-image-analysis-05-system-prompt-s3)
> 6. [第6回: 会話履歴を賢く管理する](/posts/2026-03-16-image-analysis-06-dynamodb-conversation)
> 7. [第7回: ログイン機能を30分で実装](/posts/2026-03-16-image-analysis-07-cognito-auth) ← 今ここ
> 8. [第8回: 文字が流れるように表示される仕組み](/posts/2026-03-16-image-analysis-08-streaming-display)
> 9. [第9回: React+TypeScriptで型安全なチャット画面を作る](/posts/2026-03-16-image-analysis-09-react-typescript-chat)
> 10. [第10回: サーバー代を半分にした話](/posts/2026-03-16-image-analysis-10-aws-cost-optimization)


Amazon Cognitoではじめる認証

## はじめに

Webアプリケーションを作ると、必ず必要になるのが「ログイン機能」です。

でも、認証機能を自作するのは大変です。

- パスワードの安全な保存方法は？
- パスワードリセットの仕組みは？
- 不正ログイン対策は？

これらを全部自分で実装すると、数週間かかることも珍しくありません。

本記事では、Amazon Cognitoを使って30分でログイン機能を実装する方法を解説します。

## Cognitoとは

### ユーザー管理を丸投げ

Amazon Cognitoは、AWSが提供する認証サービスです。以下の機能がすべて組み込まれています。

- **アカウント作成** - メールアドレスとパスワードでサインアップ
- **メール確認** - 確認コードの送信と検証
- **ログイン** - パスワード認証
- **パスワードリセット** - 忘れた場合の再設定
- **多要素認証（MFA）** - オプションで追加可能

これらを自分で作る必要がありません。

### セキュリティも任せる

認証システムのセキュリティは非常に重要です。Cognitoは以下の対策を標準で提供します。

- **パスワードのハッシュ化** - 安全な方式で保存
- **ブルートフォース対策** - 連続失敗でロック
- **不審なログイン検知** - 普段と違う場所からのアクセス検知
- **セッション管理** - トークンの有効期限管理

## 基本的な仕組み

### User Pool：ユーザーの家

User Poolは、ユーザー情報を保管する場所です。

```
User Pool（ユーザーの家）
├── ユーザーA
│   ├── メールアドレス
│   ├── パスワード（ハッシュ化）
│   └── カスタム属性
├── ユーザーB
└── ユーザーC
```

**設定できること：**
- パスワードポリシー（最低8文字、大文字必須など）
- メール確認の有無
- MFAの要否

### App Client：アプリとの接点

App Clientは、フロントエンドがCognitoにアクセスするための設定です。

```
フロントエンド → App Client → User Pool
               （認証リクエスト）
```

**ポイント：**
- クライアントシークレットは「なし」で設定
- SPAからの認証に対応

### JWT：認証の証明書

ログインに成功すると、3種類のトークンがもらえます。

```
ログイン成功
  ↓
┌─────────────────────────────────┐
│ ID Token                        │ ← ユーザー情報（名前、メールなど）
│ Access Token                    │ ← APIアクセス用
│ Refresh Token                   │ ← トークン更新用
└─────────────────────────────────┘
```

| トークン | 用途 | 有効期限 |
|---------|-----|---------|
| ID Token | ユーザー情報の取得 | 1時間 |
| Access Token | APIへのアクセス | 1時間 |
| Refresh Token | トークンの更新 | 30日 |

## 実装してみよう

### ステップ1：CDKでCognitoを作る

```typescript
// infrastructure/lib/image-analysis-stack.ts

import * as cognito from 'aws-cdk-lib/aws-cognito';

// User Poolの作成
const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: 'image-analysis-users',

  // サインアップ設定
  selfSignUpEnabled: true,  // ユーザー自身で登録可能
  signInAliases: {
    email: true,  // メールアドレスでログイン
  },

  // パスワードポリシー
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: false,
  },

  // メール確認
  autoVerify: {
    email: true,
  },

  // アカウント復旧
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
});

// App Clientの作成
const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
  userPool,
  userPoolClientName: 'web-client',

  // SPAからの認証に対応
  generateSecret: false,

  // 認証フロー
  authFlows: {
    userPassword: true,
    userSrp: true,
  },

  // トークン有効期限
  accessTokenValidity: cdk.Duration.hours(1),
  idTokenValidity: cdk.Duration.hours(1),
  refreshTokenValidity: cdk.Duration.days(30),
});
```

### ステップ2：フロントエンドでログイン画面

まず、Cognitoライブラリをインストールします。

```bash
npm install amazon-cognito-identity-js
```

ログイン処理を実装します。

```typescript
// frontend/src/services/auth.ts

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';

// Cognito設定
const poolData = {
  UserPoolId: import.meta.env.VITE_USER_POOL_ID,
  ClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
};

const userPool = new CognitoUserPool(poolData);

// ログイン
export function signIn(
  email: string,
  password: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    user.authenticateUser(authDetails, {
      onSuccess: (result) => {
        const token = result.getIdToken().getJwtToken();
        resolve(token);
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
}

// ログアウト
export function signOut(): void {
  const user = userPool.getCurrentUser();
  if (user) {
    user.signOut();
  }
}

// 現在のトークンを取得
export function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const user = userPool.getCurrentUser();
    if (!user) {
      resolve(null);
      return;
    }

    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) {
        resolve(null);
        return;
      }
      resolve(session.getIdToken().getJwtToken());
    });
  });
}
```

ログインフォームを作成します。

```typescript
// frontend/src/components/Login.tsx

import { useState } from 'react';
import { signIn } from '../services/auth';

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      onSuccess();
    } catch (err) {
      setError('メールアドレスまたはパスワードが正しくありません');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">ログイン</h2>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block mb-1">メールアドレス</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div className="mb-4">
        <label className="block mb-1">パスワード</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  );
}
```

### ステップ3：APIを保護する

API Gatewayに「Cognito Authorizer」を設定すると、JWTトークンを自動で検証してくれます。

```typescript
// infrastructure/lib/image-analysis-stack.ts

// Cognitoオーソライザー
const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
  this,
  'CognitoAuthorizer',
  {
    cognitoUserPools: [userPool],
  }
);

// APIエンドポイントに適用
api.root.addResource('chat').addMethod(
  'POST',
  new apigateway.LambdaIntegration(chatFunction),
  {
    authorizer,
    authorizationType: apigateway.AuthorizationType.COGNITO,
  }
);
```

Lambdaでユーザー情報を取得します。

```python
# backend/chat_handler.py

def handler(event, context):
    # Cognitoのユーザー情報はauthorizerから取得
    claims = event['requestContext']['authorizer']['claims']
    user_id = claims['sub']  # ユーザーの一意ID
    email = claims['email']

    # 以降の処理でユーザーIDを使用
    # ...
```

## 認証フローを理解する

### ログインの流れ

```
1. ユーザーがID/パスワードを入力
         ↓
2. フロントエンドがCognitoに送信
         ↓
3. Cognitoが検証
         ↓
4. 成功 → JWTトークンを発行
         ↓
5. フロントエンドがトークンを保存
         ↓
6. 以降のAPIアクセスにトークンを付与
```

### APIアクセスの流れ

```
1. フロントエンドがAPIをコール
   └─ Authorization: Bearer {JWT}
         ↓
2. API Gatewayが受信
         ↓
3. Cognito Authorizerがトークンを検証
   └─ 有効期限は？署名は正しい？
         ↓
4. 検証OK → Lambdaが実行される
   └─ ユーザー情報がeventに含まれる
```

### トークンの更新

Access Tokenは1時間で期限切れになります。でも、毎回ログインし直すのは不便です。

Refresh Tokenを使うと、自動で新しいトークンを取得できます。

```typescript
// frontend/src/services/auth.ts

export function refreshToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const user = userPool.getCurrentUser();
    if (!user) {
      reject(new Error('ログインしていません'));
      return;
    }

    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) {
        reject(err);
        return;
      }

      // セッションが有効なら自動で更新される
      resolve(session.getIdToken().getJwtToken());
    });
  });
}
```

## よくあるトラブル

### 「認証に失敗しました」

**原因1：トークンの期限切れ**
```typescript
// トークンを更新してリトライ
try {
  await callApi();
} catch (e) {
  if (e.status === 401) {
    await refreshToken();
    await callApi();  // リトライ
  }
}
```

**原因2：User Pool IDの間違い**
```
// .env.local を確認
VITE_USER_POOL_ID=us-west-2_xxxxxxxx  # リージョン + ID
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxx
```

### CORSエラー

```
Access to fetch at 'https://api...' from origin 'https://app...'
has been blocked by CORS policy
```

API GatewayでCORSを有効にする必要があります。

```typescript
// infrastructure/lib/image-analysis-stack.ts

const api = new apigateway.RestApi(this, 'Api', {
  defaultCorsPreflightOptions: {
    allowOrigins: ['https://your-app.com'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
  },
});
```

### パスワードポリシーエラー

```
Password did not conform with policy: Password must have uppercase characters
```

パスワードポリシーに合わせたバリデーションをフロントエンドにも入れましょう。

```typescript
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'パスワードは8文字以上必要です';
  }
  if (!/[A-Z]/.test(password)) {
    return 'パスワードには大文字を含めてください';
  }
  if (!/[a-z]/.test(password)) {
    return 'パスワードには小文字を含めてください';
  }
  if (!/[0-9]/.test(password)) {
    return 'パスワードには数字を含めてください';
  }
  return null;  // OK
}
```

## まとめ

### 30分でできたこと

- ✅ ユーザー登録（サインアップ）
- ✅ メール確認
- ✅ ログイン/ログアウト
- ✅ パスワードリセット
- ✅ APIの保護（認証必須化）
- ✅ セキュアなセッション管理

### セキュリティのベストプラクティス

| 項目 | 推奨設定 |
|-----|---------|
| パスワード最小長 | 8文字以上 |
| パスワード複雑性 | 大文字・小文字・数字を必須 |
| メール確認 | 有効 |
| Access Token有効期限 | 1時間 |
| Refresh Token有効期限 | 30日 |
| クライアントシークレット | なし（SPA） |

### チェックリスト

- [ ] User Poolの作成
- [ ] App Clientの作成
- [ ] フロントエンドのログイン画面
- [ ] API Gatewayのオーソライザー設定
- [ ] トークン更新処理の実装
- [ ] エラーハンドリング

## 参考リンク

- [Amazon Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [amazon-cognito-identity-js](https://www.npmjs.com/package/amazon-cognito-identity-js)
- [API Gateway Cognito Authorizer](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html)
