"use strict";
// src/types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovelAssistantConfigSchema = void 0;
const zod_1 = require("zod");
// 1. 設定スキーマ (zod) と型
// package.jsonのconfigurationと対応
exports.NovelAssistantConfigSchema = zod_1.z.object({
    provider: zod_1.z.enum(['openrouter', 'openai']),
    model: zod_1.z.string().min(1),
    endpoint: zod_1.z.string().url(),
    temperature: zod_1.z.number().min(0).max(2),
    maxTokens: zod_1.z.number().int().positive(),
    output: zod_1.z.object({
        chapterLengthChars: zod_1.z.tuple([zod_1.z.number().int(), zod_1.z.number().int()]),
        summarySentences: zod_1.z.number().int().positive(),
    }),
    // --- ▼▼▼ ここから追加 ▼▼▼ ---
    paths: zod_1.z.object({
        bible: zod_1.z.string(),
        outline: zod_1.z.string(),
        chapters: zod_1.z.string(),
        summaries: zod_1.z.string(),
        reports: zod_1.z.string(),
        prompts: zod_1.z.string(),
    }),
    // --- ▲▲▲ ここまで追加 ▲▲▲ ---
    consistency: zod_1.z.object({
        strictness: zod_1.z.enum(['low', 'medium', 'high']),
    }),
    providerOptions: zod_1.z.object({
        openrouter: zod_1.z.object({
            httpReferer: zod_1.z.string().optional(),
            xTitle: zod_1.z.string().optional(),
        }),
    }),
    rateLimit: zod_1.z.object({
        rpm: zod_1.z.number().int().positive(),
        burst: zod_1.z.number().int().positive(),
    }),
    telemetry: zod_1.z.object({
        enabled: zod_1.z.boolean(),
    }),
});
//# sourceMappingURL=types.js.map