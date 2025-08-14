"use strict";
// src/types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoryGameConfigSchema = void 0;
const zod_1 = require("zod");
// 1. 設定スキーマ (zod) と型
// package.jsonのconfigurationと対応
exports.StoryGameConfigSchema = zod_1.z.object({
    provider: zod_1.z.enum(['openrouter', 'openai']),
    model: zod_1.z.string().min(1),
    endpoint: zod_1.z.string().url(),
    temperature: zod_1.z.number().min(0).max(2),
    maxTokens: zod_1.z.number().int().positive(),
    providerOptions: zod_1.z.object({
        openrouter: zod_1.z.object({
            httpReferer: zod_1.z.string().optional(),
            xTitle: zod_1.z.string().optional(),
        }),
    }),
});
//# sourceMappingURL=types.js.map