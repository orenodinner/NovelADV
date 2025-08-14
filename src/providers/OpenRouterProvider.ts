// src/providers/OpenRouterProvider.ts

import axios, { AxiosError } from 'axios';
import { Readable } from 'stream';
import { ChatProvider, ChatCompletionOptions, ChatCompletionResult } from '../types';
import { ConfigService } from '../services/ConfigService';
import { KeytarService } from '../services/KeytarService';

export class OpenRouterProvider implements ChatProvider {
    readonly name = 'openrouter';

    private configService: ConfigService;
    private keytarService: KeytarService;

    constructor() {
        this.configService = ConfigService.getInstance();
        this.keytarService = KeytarService.getInstance();
    }

    async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
        const config = this.configService.get();
        const apiKey = await this.keytarService.getApiKey('openrouter');

        // --- ▼▼▼ ここから修正 ▼▼▼ ---
        // APIキーがnull、または空文字列の場合にエラーをスローする
        if (!apiKey || apiKey.trim() === '') {
            throw new Error('API key is not set. Please set it to continue.');
        }
        // --- ▲▲▲ ここまで修正 ▲▲▲ ---

        const headers: Record<string, string> = {
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
            stream: typeof options.onStream === 'function',
        };

        try {
            const response = await axios.post(config.endpoint, body, {
                headers: headers,
                responseType: body.stream ? 'stream' : 'json',
                signal: options.abortSignal,
            });
            
            if (body.stream) {
                return this.handleStreamResponse(response.data, options.onStream);
            } else {
                const text = response.data.choices[0]?.message?.content || '';
                return {
                    text: text,
                    raw: response.data,
                };
            }

        } catch (error) {
            // --- ▼▼▼ ここから修正 ▼▼▼ ---
            if (error instanceof AxiosError) {
                // 401 Unauthorized エラーの場合は、キーが不正である可能性が高い
                if (error.response?.status === 401) {
                    throw new Error('API key is not set or invalid (401 Unauthorized). Please set it.');
                }
                const errorData = error.response?.data;
                const errorMessage = errorData?.error?.message || error.message;
                console.error('OpenRouter API Error:', errorData);
                throw new Error(`OpenRouter API Error: ${errorMessage}`);
            }
            // --- ▲▲▲ ここまで修正 ▲▲▲ ---
            console.error('Unknown error during API call:', error);
            throw new Error('An unknown error occurred while communicating with OpenRouter.');
        }
    }

    private handleStreamResponse(
        stream: Readable,
        onStream?: (chunk: string) => void
    ): Promise<ChatCompletionResult> {
        return new Promise((resolve, reject) => {
            let fullText = '';
            let buffer = '';

            stream.on('data', (chunk: Buffer) => {
                buffer += chunk.toString('utf-8');
                
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

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
                        } catch (e) {
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