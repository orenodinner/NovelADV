// src/types.ts

import { z } from 'zod';

// 1. 設定スキーマ (zod) と型
// package.jsonのconfigurationと対応
export const StoryGameConfigSchema = z.object({
  provider: z.enum(['openrouter', 'openai']),
  model: z.string().min(1),
  endpoint: z.string().url(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
  providerOptions: z.object({
    openrouter: z.object({
      httpReferer: z.string().optional(),
      xTitle: z.string().optional(),
    }),
  }),
});

// zodスキーマからTypeScriptの型を生成
export type StoryGameConfig = z.infer<typeof StoryGameConfigSchema>;


// 2. チャットメッセージのデータモデル
export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}


// 3. LLMプロバイダのインターフェース
export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  // ストリーミング応答を処理するためのコールバック
  onStream?: (chunk: string) => void;
  // 中断シグナル
  abortSignal?: AbortSignal;
}

export interface ChatCompletionResult {
  text: string;
  raw?: unknown; // 元のAPIレスポンス
  finishReason?: 'stop' | 'length' | 'error';
}

export interface ChatProvider {
  name: string;
  // チャット補完を実行するメソッド
  chat(options: ChatCompletionOptions): Promise<ChatCompletionResult>;
}

// 4. セッションデータモデル (新規追加)
export interface SessionData {
    systemPrompt: string | null;
    history: ChatMessage[];
    autoSaveJsonPath?: string;
}