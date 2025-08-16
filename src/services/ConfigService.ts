// src/services/ConfigService.ts

import * as vscode from 'vscode';
import { StoryGameConfig, StoryGameConfigSchema } from '../types';

export class ConfigService implements vscode.Disposable {
    private static instance: ConfigService;
    private config: StoryGameConfig | null = null;
    private readonly disposables: vscode.Disposable[] = [];

    private constructor() {
        this.loadConfig();
        
        const disposable = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('interactive-story')) {
                this.loadConfig();
            }
        });
        this.disposables.push(disposable);
    }

    /**
     * インスタンスを破棄する
     */
    public dispose() {
        this.disposables.forEach(d => d.dispose());
        ConfigService.instance = undefined!;
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
        const rawConfig = vscode.workspace.getConfiguration('interactive-story');
        
        // chatとsummarizationの各設定を読み込むヘルパー関数
        const getLlmConfig = (path: 'chat' | 'summarization') => ({
            provider: rawConfig.get(`${path}.provider`),
            model: rawConfig.get(`${path}.model`),
            endpoint: rawConfig.get(`${path}.endpoint`),
            temperature: rawConfig.get(`${path}.temperature`),
            maxTokens: rawConfig.get(`${path}.maxTokens`),
            providerOptions: {
                openrouter: {
                    httpReferer: rawConfig.get(`${path}.providerOptions.openrouter.httpReferer`),
                    xTitle: rawConfig.get(`${path}.providerOptions.openrouter.xTitle`),
                }
            },
        });

        const configObject = {
            chat: getLlmConfig('chat'),
            summarization: getLlmConfig('summarization'),
        };

        const result = StoryGameConfigSchema.safeParse(configObject);

        if (result.success) {
            this.config = result.data;
            console.log('Interactive Story Game configuration loaded successfully.');
        } else {
            this.config = null;
            vscode.window.showErrorMessage('Failed to load Interactive Story Game configuration. Please check your settings.');
            console.error('Interactive Story Game configuration error:', result.error.flatten());
        }
    }
    
    /**
     * 検証済みの設定オブジェクトを取得する
     * @returns {StoryGameConfig} 型安全な設定オブジェクト
     * @throws {Error} 設定がロードまたは検証されていない場合にエラーをスロー
     */
    public get(): StoryGameConfig {
        if (!this.config) {
            this.loadConfig();
            if (!this.config) {
                 throw new Error('Interactive Story Game configuration is not loaded or invalid.');
            }
        }
        return this.config;
    }
}