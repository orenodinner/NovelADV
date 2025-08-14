// src/services/ConfigService.ts

import * as vscode from 'vscode';
import { StoryGameConfig, StoryGameConfigSchema } from '../types';

export class ConfigService {
    private static instance: ConfigService;
    private config: StoryGameConfig | null = null;
    private readonly disposables: vscode.Disposable[] = [];

    private constructor() {
        this.loadConfig();
        
        // 設定が変更されたらリロードする
        const disposable = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('interactive-story')) {
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
        const rawConfig = vscode.workspace.getConfiguration('interactive-story');
        
        // package.jsonから設定をマージ
        const configObject = {
            provider: rawConfig.get('provider'),
            model: rawConfig.get('model'),
            endpoint: rawConfig.get('endpoint'),
            temperature: rawConfig.get('temperature'),
            maxTokens: rawConfig.get('maxTokens'),
            providerOptions: {
                openrouter: {
                    httpReferer: rawConfig.get('providerOptions.openrouter.httpReferer'),
                    xTitle: rawConfig.get('providerOptions.openrouter.xTitle'),
                }
            },
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
            this.loadConfig(); // 設定がnullの場合、再読み込みを試みる
            if (!this.config) { //それでもnullならエラー
                 throw new Error('Interactive Story Game configuration is not loaded or invalid.');
            }
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