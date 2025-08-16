// src/types.ts

import { z } from 'zod';

// 1. LLMごとの設定を再利用可能なスキーマとして定義
const LlmProviderOptionsSchema = z.object({
  openrouter: z.object({
    httpReferer: z.string().optional(),
    xTitle: z.string().optional(),
  }),
});

export const LlmConfigSchema = z.object({
  provider: z.enum(['openrouter', 'openai']),
  model: z.string().min(1, "Model name cannot be empty."),
  endpoint: z.string().url("Endpoint must be a valid URL."),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
  providerOptions: LlmProviderOptionsSchema,
});


// 2. メインの設定スキーマを更新
export const StoryGameConfigSchema = z.object({
  // 物語生成（チャット）用の設定
  chat: LlmConfigSchema,
  // 要約やキャラクター更新など、メタタスク用の設定
  summarization: LlmConfigSchema,
});


// 3. 型定義
// ZodスキーマからTypeScriptの型を生成
export type LlmConfig = z.infer<typeof LlmConfigSchema>;
export type StoryGameConfig = z.infer<typeof StoryGameConfigSchema>;


// 4. チャットメッセージのデータモデル (変更なし)
export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}


// 5. LLMプロバイダのインターフェース (一部変更)
export interface ChatCompletionOptions {
  messages: ChatMessage[];
  // オプショナルでLLM設定を上書きできるようにする
  overrideConfig?: Partial<LlmConfig>;
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

// 6. セッションデータモデル (変更なし)
export interface SessionData {
    systemPrompt: string | null;
    history: ChatMessage[];
    summary: string;
    autoSaveJsonPath?: string;
}