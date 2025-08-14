"use strict";
// src/services/ConfigService.ts
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
exports.ConfigService = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
class ConfigService {
    constructor() {
        this.config = null;
        this.disposables = [];
        this.loadConfig();
        // 設定が変更されたらリロードする
        const disposable = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('interactive-story')) {
                this.loadConfig();
            }
        });
        this.disposables.push(disposable);
    }
    static getInstance() {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }
    /**
     * VS Codeの設定から設定値を読み込み、Zodスキーマで検証する
     */
    loadConfig() {
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
        const result = types_1.StoryGameConfigSchema.safeParse(configObject);
        if (result.success) {
            this.config = result.data;
            console.log('Interactive Story Game configuration loaded successfully.');
        }
        else {
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
    get() {
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
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
exports.ConfigService = ConfigService;
//# sourceMappingURL=ConfigService.js.map