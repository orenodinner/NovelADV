// src/types.ts

import { z } from 'zod';

// 1. 設定スキーマ (zod) と型
// package.jsonのconfigurationと対応
export const NovelAssistantConfigSchema = z.object({
  provider: z.enum(['openrouter', 'openai']),
  model: z.string().min(1),
  endpoint: z.string().url(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
  output: z.object({
    chapterLengthChars: z.tuple([z.number().int(), z.number().int()]),
    summarySentences: z.number().int().positive(),
  }),
  // --- ▼▼▼ ここから追加 ▼▼▼ ---
  paths: z.object({
    bible: z.string(),
    outline: z.string(),
    chapters: z.string(),
    summaries: z.string(),
    reports: z.string(),
    prompts: z.string(),
  }),
  // --- ▲▲▲ ここまで追加 ▲▲▲ ---
  consistency: z.object({
    strictness: z.enum(['low', 'medium', 'high']),
  }),
  providerOptions: z.object({
    openrouter: z.object({
      httpReferer: z.string().optional(),
      xTitle: z.string().optional(),
    }),
  }),
  rateLimit: z.object({
    rpm: z.number().int().positive(),
    burst: z.number().int().positive(),
  }),
  telemetry: z.object({
    enabled: z.boolean(),
  }),
});

// zodスキーマからTypeScriptの型を生成
export type NovelAssistantConfig = z.infer<typeof NovelAssistantConfigSchema>;


// 2. 伏線表のデータモデル
export interface Foreshadow {
  id: string;
  type: 'hint' | 'item' | 'character_arc' | 'plot_twist' | string; // 拡張可能にする
  status: 'open' | 'resolved' | 'pending';
  introduced_in: string; // 例: 'chap_02'
  resolved_in?: string;  // 例: 'chap_10'
  description: string;
  notes?: string;
}


// 3. チャットメッセージのデータモデル
export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}


// 4. LLMプロバイダのインターフェース
export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  // ストリーミング応答を処理するためのコールバック
  onStream?: (chunk: string) => void;
  // JSONモードの指定
  responseFormat?: { type: "json_object" };
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
  // プロバイダがJSONモードをネイティブでサポートしているか
  supportsJSON: boolean; 
  // チャット補完を実行するメソッド
  chat(options: ChatCompletionOptions): Promise<ChatCompletionResult>;
}


// 5. ログエントリのデータモデル
export interface LogEntry {
  id: string; // ユニークID (e.g., UUID)
  timestamp: string; // ISO 8601 format
  type: 'generation' | 'summarization' | 'foreshadow_update' | 'consistency_check' | 'user_message' | 'error';
  request: {
    provider: string;
    model: string;
    prompt: string;
    contextSnippets: Record<string, string>; // { characters.md: "抜粋...", world.md: "抜粋..." }
  };
  response: {
    text: string;
    raw?: any;
    durationMs: number;
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
  };
  metadata?: Record<string, any>; // その他の情報
}