// src/services/ConfigService.ts

import * as vscode from 'vscode';
import { NovelAssistantConfig, NovelAssistantConfigSchema } from '../types';

export class ConfigService {
    private static instance: ConfigService;
    private config: NovelAssistantConfig | null = null;
    private readonly disposables: vscode.Disposable[] = [];

    private constructor() {
        this.loadConfig();
        
        // 設定が変更されたらリロードする
        const disposable = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('novelAssistant')) {
                this.loadConfig();
            }
        });
        this.disposables.push(disposable);
    }

    public static getInstance(): ConfigService {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }

    /**
     * VS Codeの設定から設定値を読み込み、Zodスキーマで検証する
     */
    private loadConfig(): void {
        const rawConfig = vscode.workspace.getConfiguration('novelAssistant');
        const novelRc = vscode.workspace.getConfiguration('novelrc'); // .novelrc.jsonの値を読む
        
        // package.jsonと.novelrc.jsonから設定をマージ
        const configObject = {
            provider: rawConfig.get('provider'),
            model: rawConfig.get('model'),
            endpoint: rawConfig.get('endpoint'),
            temperature: rawConfig.get('temperature'),
            maxTokens: rawConfig.get('maxTokens'),
            output: {
                chapterLengthChars: rawConfig.get('output.chapterLengthChars'),
                summarySentences: rawConfig.get('output.summarySentences'),
            },
            // --- ▼▼▼ ここから追加 ▼▼▼ ---
            paths: {
                bible: novelRc.get('paths.bible', 'bible'),
                outline: novelRc.get('paths.outline', 'outline'),
                chapters: novelRc.get('paths.chapters', 'chapters'),
                summaries: novelRc.get('paths.summaries', 'summaries'),
                reports: novelRc.get('paths.reports', 'reports'),
                prompts: novelRc.get('paths.prompts', 'prompts'),
            },
            // --- ▲▲▲ ここまで追加 ▲▲▲ ---
            consistency: {
                strictness: rawConfig.get('consistency.strictness'),
            },
            providerOptions: {
                openrouter: {
                    httpReferer: rawConfig.get('providerOptions.openrouter.httpReferer'),
                    xTitle: rawConfig.get('providerOptions.openrouter.xTitle'),
                }
            },
            rateLimit: {
                rpm: rawConfig.get('rateLimit.rpm'),
                burst: rawConfig.get('rateLimit.burst'),
            },
            telemetry: {
                enabled: rawConfig.get('telemetry.enabled'),
            }
        };

        const result = NovelAssistantConfigSchema.safeParse(configObject);

        if (result.success) {
            this.config = result.data;
            console.log('Novel Assistant configuration loaded successfully.');
        } else {
            this.config = null;
            vscode.window.showErrorMessage('Failed to load Novel Assistant configuration. Please check your settings.');
            console.error('Novel Assistant configuration error:', result.error.flatten());
        }
    }
    
    /**
     * 検証済みの設定オブジェクトを取得する
     * @returns {NovelAssistantConfig} 型安全な設定オブジェクト
     * @throws {Error} 設定がロードまたは検証されていない場合にエラーをスロー
     */
    public get(): NovelAssistantConfig {
        if (!this.config) {
            throw new Error('Novel Assistant configuration is not loaded or invalid.');
        }
        return this.config;
    }

    /**
     * 拡張機能の無効化時にリソースを解放する
     */
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}