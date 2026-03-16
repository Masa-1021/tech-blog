---
title: "React+TypeScriptで型安全なチャット画面を作る"
emoji: "⚛️"
type: "tech"
topics: ["React", "TypeScript", "Frontend", "StateManagement"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "React + TypeScriptでAIチャット画面を型安全に実装。Context + useReducerによる状態管理パターン。"
series: "製造業向けAI画像分析システムを作る"
seriesOrder: 9
coverImage: "/images/posts/laptop-code.jpg"
---


> **このシリーズ: 全10回**
> 1. [第1回: AIの回答を待ちきれない？30秒の壁を乗り越える方法](/posts/2026-03-16-image-analysis-01-lambda-streaming)
> 2. [第2回: 工場の図面をAIに読ませたい](/posts/2026-03-16-image-analysis-02-factory-image-analysis)
> 3. [第3回: Amazon BedrockでAIチャットを作る](/posts/2026-03-16-image-analysis-03-bedrock-api-guide)
> 4. [第4回: 「しばらくお待ちください」で終わらせない](/posts/2026-03-16-image-analysis-04-error-handling)
> 5. [第5回: AIの性格は設定ファイルで変える](/posts/2026-03-16-image-analysis-05-system-prompt-s3)
> 6. [第6回: 会話履歴を賢く管理する](/posts/2026-03-16-image-analysis-06-dynamodb-conversation)
> 7. [第7回: ログイン機能を30分で実装](/posts/2026-03-16-image-analysis-07-cognito-auth)
> 8. [第8回: 文字が流れるように表示される仕組み](/posts/2026-03-16-image-analysis-08-streaming-display)
> 9. [第9回: React+TypeScriptで型安全なチャット画面を作る](/posts/2026-03-16-image-analysis-09-react-typescript-chat) ← 今ここ
> 10. [第10回: サーバー代を半分にした話](/posts/2026-03-16-image-analysis-10-aws-cost-optimization)


状態管理のベストプラクティス

## はじめに

AIチャットアプリのフロントエンドを作るとき、「データの流れ」が複雑になりがちです。

- ユーザーがメッセージを送る
- AIからストリーミングで返ってくる
- 会話履歴を管理する
- ログイン状態を保持する

これらを整理するために、TypeScriptの型安全性とReactの状態管理パターンが役立ちます。

本記事では、実際のプロジェクトで使用した設計パターンを解説します。

## なぜTypeScriptか

### 型があると何が嬉しいか

JavaScriptだけで開発していると、こんなバグに悩まされます。

```javascript
// JavaScript
function sendMessage(message) {
  api.post('/chat', { msg: message });  // typo: message → msg
}

// 実行時エラー：サーバーが「message がない」と言う
```

TypeScriptなら、書いた瞬間にエラーが分かります。

```typescript
// TypeScript
type ChatRequest = {
  message: string;
  imageUrl?: string;
};

function sendMessage(request: ChatRequest) {
  api.post('/chat', { msg: request.message });
  // ↑ エラー: 'msg' は ChatRequest に存在しません
}
```

**メリット：**
- 実行前にバグを発見
- IDEの補完が効く
- リファクタリングが安全

## プロジェクト構成

### 使用技術

| 技術 | バージョン | 用途 |
|-----|----------|-----|
| React | 19 | UIフレームワーク |
| TypeScript | 5.x | 型安全性 |
| Vite | 6.x | ビルドツール |
| Tailwind CSS | 3.x | スタイリング |

### フォルダ構成

```
frontend/src/
├── components/       # UIコンポーネント
│   ├── ChatInterface.tsx
│   ├── MessageList.tsx
│   ├── MessageInput.tsx
│   └── ImageUpload.tsx
├── contexts/         # React Context
│   └── AuthContext.tsx
├── hooks/            # カスタムフック
│   └── useChat.ts
├── services/         # API呼び出し
│   ├── apiClient.ts
│   └── auth.ts
├── types/            # 型定義
│   └── index.ts
└── App.tsx
```

## 型定義から始める

### メッセージの型

まず、アプリで扱うデータの型を定義します。

```typescript
// frontend/src/types/index.ts

// メッセージの役割
export type MessageRole = 'user' | 'assistant';

// 1つのメッセージ
export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  imageUrl?: string;
  timestamp: number;
};

// チャットセッション
export type Session = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

// API レスポンス
export type ChatResponse = {
  sessionId: string;
  message: Message;
};

// ストリーミングのチャンク
export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'ping' }
  | { type: 'done'; usage?: { input_tokens: number; output_tokens: number } }
  | { type: 'error'; message: string };
```

### なぜ型を先に決めるか

1. **設計が明確になる** - どんなデータを扱うか整理できる
2. **実装時のミスが減る** - 型がガイドラインになる
3. **チーム開発に強い** - 共通認識ができる

## Context + useReducerで状態管理

### なぜReduxを使わないか

Reduxは強力ですが、このアプリには少し大げさです。

- セットアップが複雑
- 学習コストが高い
- 小〜中規模には過剰

React標準の`Context` + `useReducer`で十分対応できます。

### Contextとは

Contextは、コンポーネントツリーの深い場所にデータを渡す仕組みです。

```
❌ Props のバケツリレー
App → Header → Nav → UserName
     (user)  (user)  (user)

✅ Context
App [user in Context]
 ├── Header
 │    └── Nav
 │         └── UserName [user from Context]
 └── Main
      └── ...
```

### useReducerとは

`useReducer`は、複雑な状態更新を整理するフックです。

```typescript
// 状態
type State = {
  count: number;
};

// アクション
type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'set'; value: number };

// Reducer：アクションに応じて状態を更新
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    case 'set':
      return { count: action.value };
  }
}
```

## 実装してみよう

### ステップ1：型を定義

```typescript
// frontend/src/types/chat.ts

// チャットの状態
export type ChatState = {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
  error: string | null;
};

// アクション
export type ChatAction =
  | { type: 'SET_SESSIONS'; sessions: Session[] }
  | { type: 'SELECT_SESSION'; sessionId: string }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'START_LOADING' }
  | { type: 'STOP_LOADING' }
  | { type: 'APPEND_STREAMING'; content: string }
  | { type: 'FINISH_STREAMING' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' };
```

### ステップ2：Reducerを作成

```typescript
// frontend/src/reducers/chatReducer.ts

import { ChatState, ChatAction } from '../types/chat';

export const initialState: ChatState = {
  sessions: [],
  currentSessionId: null,
  messages: [],
  isLoading: false,
  streamingContent: '',
  error: null,
};

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_SESSIONS':
      return {
        ...state,
        sessions: action.sessions,
      };

    case 'SELECT_SESSION':
      return {
        ...state,
        currentSessionId: action.sessionId,
        messages: [],  // 新しいセッションのメッセージを読み込む前にクリア
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
      };

    case 'START_LOADING':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'STOP_LOADING':
      return {
        ...state,
        isLoading: false,
      };

    case 'APPEND_STREAMING':
      return {
        ...state,
        streamingContent: state.streamingContent + action.content,
      };

    case 'FINISH_STREAMING':
      // ストリーミング完了：確定メッセージとして追加
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: state.streamingContent,
        timestamp: Date.now(),
      };
      return {
        ...state,
        messages: [...state.messages, newMessage],
        streamingContent: '',
        isLoading: false,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
        isLoading: false,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}
```

### ステップ3：Providerを作成

```typescript
// frontend/src/contexts/ChatContext.tsx

import {
  createContext,
  useContext,
  useReducer,
  ReactNode,
} from 'react';
import { chatReducer, initialState } from '../reducers/chatReducer';
import { ChatState, ChatAction } from '../types/chat';

// Contextの型
type ChatContextType = {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
};

// Context作成
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Provider
export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  return (
    <ChatContext.Provider value={{ state, dispatch }}>
      {children}
    </ChatContext.Provider>
  );
}

// カスタムフック
export function useChat(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}
```

### ステップ4：フックで使う

```typescript
// frontend/src/hooks/useChatActions.ts

import { useCallback } from 'react';
import { useChat } from '../contexts/ChatContext';
import { fetchStreaming } from '../services/apiClient';
import { Message } from '../types';

export function useChatActions() {
  const { state, dispatch } = useChat();

  // メッセージ送信
  const sendMessage = useCallback(
    async (content: string, imageUrl?: string) => {
      // ユーザーメッセージを追加
      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        imageUrl,
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_MESSAGE', message: userMessage });
      dispatch({ type: 'START_LOADING' });

      try {
        await fetchStreaming(
          '/api/analyze',
          {
            prompt: content,
            imageUrl,
            sessionId: state.currentSessionId,
          },
          (chunk) => {
            switch (chunk.type) {
              case 'text':
                dispatch({ type: 'APPEND_STREAMING', content: chunk.content || '' });
                break;
              case 'done':
                dispatch({ type: 'FINISH_STREAMING' });
                break;
              case 'error':
                dispatch({ type: 'SET_ERROR', error: chunk.message || 'エラー' });
                break;
            }
          }
        );
      } catch (e) {
        dispatch({ type: 'SET_ERROR', error: '通信エラーが発生しました' });
      }
    },
    [dispatch, state.currentSessionId]
  );

  // セッション選択
  const selectSession = useCallback(
    (sessionId: string) => {
      dispatch({ type: 'SELECT_SESSION', sessionId });
    },
    [dispatch]
  );

  return {
    messages: state.messages,
    streamingContent: state.streamingContent,
    isLoading: state.isLoading,
    error: state.error,
    sendMessage,
    selectSession,
  };
}
```

## コンポーネント設計

### 分割の考え方

1つのコンポーネントに詰め込みすぎず、責務を明確に分けます。

```
ChatInterface（全体の枠）
├── SessionList（セッション一覧）
├── MessageList（メッセージ表示）
│   └── MessageBubble（1つのメッセージ）
├── ImageUpload（画像アップロード）
└── MessageInput（入力欄）
```

### 主要コンポーネント

**ChatInterface：全体の枠**

```typescript
// frontend/src/components/ChatInterface.tsx

import { ChatProvider } from '../contexts/ChatContext';
import { SessionList } from './SessionList';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function ChatInterface() {
  return (
    <ChatProvider>
      <div className="flex h-screen">
        {/* サイドバー */}
        <aside className="w-64 bg-gray-100 p-4">
          <SessionList />
        </aside>

        {/* メインエリア */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            <MessageList />
          </div>
          <div className="border-t p-4">
            <MessageInput />
          </div>
        </main>
      </div>
    </ChatProvider>
  );
}
```

**MessageList：メッセージ一覧**

```typescript
// frontend/src/components/MessageList.tsx

import { useRef, useEffect } from 'react';
import { useChatActions } from '../hooks/useChatActions';
import { MessageBubble } from './MessageBubble';

export function MessageList() {
  const { messages, streamingContent, isLoading } = useChatActions();
  const bottomRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージで自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* ストリーミング中 */}
      {streamingContent && (
        <MessageBubble
          message={{
            id: 'streaming',
            role: 'assistant',
            content: streamingContent,
            timestamp: Date.now(),
          }}
          isStreaming
        />
      )}

      {/* ローディング */}
      {isLoading && !streamingContent && (
        <div className="text-gray-500">考え中...</div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
```

**MessageInput：入力欄**

```typescript
// frontend/src/components/MessageInput.tsx

import { useState } from 'react';
import { useChatActions } from '../hooks/useChatActions';
import { ImageUpload } from './ImageUpload';

export function MessageInput() {
  const [input, setInput] = useState('');
  const [imageUrl, setImageUrl] = useState<string>();
  const { sendMessage, isLoading } = useChatActions();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !imageUrl) return;

    sendMessage(input, imageUrl);
    setInput('');
    setImageUrl(undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {/* 画像プレビュー */}
      {imageUrl && (
        <div className="relative inline-block">
          <img src={imageUrl} alt="" className="h-20 rounded" />
          <button
            type="button"
            onClick={() => setImageUrl(undefined)}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <ImageUpload onUpload={setImageUrl} />

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力..."
          className="flex-1 border rounded px-3 py-2"
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={isLoading || (!input.trim() && !imageUrl)}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          送信
        </button>
      </div>
    </form>
  );
}
```

## TypeScriptの恩恵

### コンパイル時にエラー発見

```typescript
// 存在しないプロパティ
dispatch({ type: 'INVALID_ACTION' });
// ↑ エラー: 'INVALID_ACTION' は ChatAction に存在しません

// 型の不一致
const msg: Message = {
  id: '1',
  role: 'system',  // ← エラー: 'system' は MessageRole に存在しません
  content: 'hello',
  timestamp: Date.now(),
};
```

### IDEの補完が効く

```typescript
function handleChunk(chunk: StreamChunk) {
  chunk.  // ← type, content?, message? が候補に出る

  if (chunk.type === 'text') {
    chunk.content  // ← string | undefined と推論される
  }
}
```

## よくある問題と解決

### 型エラーが消えない

**as const の活用**

```typescript
// ❌ string[] と推論される
const roles = ['user', 'assistant'];

// ✅ readonly ['user', 'assistant'] と推論される
const roles = ['user', 'assistant'] as const;
```

**型ガードの書き方**

```typescript
function isTextChunk(chunk: StreamChunk): chunk is { type: 'text'; content: string } {
  return chunk.type === 'text';
}

// 使用例
if (isTextChunk(chunk)) {
  console.log(chunk.content);  // string として扱える
}
```

### anyを使いたくなったら

```typescript
// ❌ any を使う
const data: any = await response.json();

// ✅ unknown で受けて型ガード
const data: unknown = await response.json();

if (isValidResponse(data)) {
  // 型が絞り込まれる
}

function isValidResponse(data: unknown): data is ChatResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'sessionId' in data &&
    'message' in data
  );
}
```

## まとめ

### 型安全のメリット

| 観点 | JavaScript | TypeScript |
|-----|-----------|------------|
| バグ発見 | 実行時 | コンパイル時 |
| リファクタリング | 怖い | 安全 |
| ドキュメント | 別途必要 | 型が説明 |
| IDE補完 | 限定的 | 強力 |

### 状態管理のパターン

```
小規模: useState のみ
  ↓
中規模: Context + useReducer（本記事）
  ↓
大規模: Redux / Zustand / Jotai
```

### チェックリスト

- [ ] 型定義ファイルの作成
- [ ] Reducerの実装
- [ ] Context Providerの作成
- [ ] カスタムフックの作成
- [ ] コンポーネントの分割
- [ ] strict modeの有効化

## 参考リンク

- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [useReducer Documentation](https://react.dev/reference/react/useReducer)
- [Context Documentation](https://react.dev/learn/passing-data-deeply-with-context)
