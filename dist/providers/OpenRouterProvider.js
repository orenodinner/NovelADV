"use strict";
// src/providers/OpenRouterProvider.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterProvider = void 0;
const axios_1 = __importStar(require("axios"));
const ConfigService_1 = require("../services/ConfigService");
const KeytarService_1 = require("../services/KeytarService");
class OpenRouterProvider {
    constructor() {
        this.name = 'openrouter';
        this.configService = ConfigService_1.ConfigService.getInstance();
        this.keytarService = KeytarService_1.KeytarService.getInstance();
    }
    async chat(options) {
        const config = this.configService.get();
        const apiKey = await this.keytarService.getApiKey('openrouter');
        if (!apiKey) {
            throw new Error('OpenRouter API key is not set. Please set it via the command palette.');
        }
        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };
        if (config.providerOptions.openrouter.httpReferer) {
            headers['HTTP-Referer'] = config.providerOptions.openrouter.httpReferer;
        }
        if (config.providerOptions.openrouter.xTitle) {
            headers['X-Title'] = config.providerOptions.openrouter.xTitle;
        }
        const body = {
            model: config.model,
            messages: options.messages,
            temperature: options.temperature ?? config.temperature,
            max_tokens: options.maxTokens ?? config.maxTokens,
            stream: typeof options.onStream === 'function', // ストリーミングを有効にするか
        };
        try {
            const response = await axios_1.default.post(config.endpoint, body, {
                headers: headers,
                responseType: body.stream ? 'stream' : 'json',
                signal: options.abortSignal, // axiosはAbortSignalをサポート
            });
            if (body.stream) {
                return this.handleStreamResponse(response.data, options.onStream);
            }
            else {
                const text = response.data.choices[0]?.message?.content || '';
                return {
                    text: text,
                    raw: response.data,
                };
            }
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                const errorData = error.response?.data;
                const errorMessage = errorData?.error?.message || error.message;
                console.error('OpenRouter API Error:', errorData);
                throw new Error(`OpenRouter API Error: ${errorMessage}`);
            }
            console.error('Unknown error during API call:', error);
            throw new Error('An unknown error occurred while communicating with OpenRouter.');
        }
    }
    handleStreamResponse(stream, onStream) {
        return new Promise((resolve, reject) => {
            let fullText = '';
            let buffer = '';
            stream.on('data', (chunk) => {
                buffer += chunk.toString('utf-8');
                // ストリームは `data: ...\n\n` の形式で送られてくる
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ''; // 最後の不完全な行をバッファに残す
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        if (data.trim() === '[DONE]') {
                            continue;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const textChunk = parsed.choices[0]?.delta?.content || '';
                            if (textChunk) {
                                fullText += textChunk;
                                onStream?.(textChunk);
                            }
                        }
                        catch (e) {
                            console.error('Failed to parse stream chunk:', e, 'Chunk:', data);
                        }
                    }
                }
            });
            stream.on('end', () => {
                resolve({ text: fullText });
            });
            stream.on('error', (err) => {
                console.error('Stream Error:', err);
                reject(new Error('Error processing stream from OpenRouter.'));
            });
        });
    }
}
exports.OpenRouterProvider = OpenRouterProvider;
//# sourceMappingURL=OpenRouterProvider.js.map