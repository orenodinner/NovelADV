"use strict";
// src/services/KeytarService.ts
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
exports.KeytarService = void 0;
const vscode = __importStar(require("vscode"));
// keytarはCommonJSモジュールなので、import文のスタイルを合わせる
const keytar = require("keytar");
// keytarで使用するサービス名。拡張機能で一意にする。
const SERVICE_NAME = 'vscode-novel-assistant';
class KeytarService {
    constructor() {
        // コンストラクタは空でもOK。シングルトンを強制するためにprivateにする。
    }
    static getInstance() {
        if (!KeytarService.instance) {
            KeytarService.instance = new KeytarService();
        }
        return KeytarService.instance;
    }
    /**
     * プロバイダ名からkeytarで使用するアカウント名を生成する
     * @param provider プロバイダ名 (e.g., 'openrouter')
     */
    getAccountForProvider(provider) {
        return `${provider}-api-key`;
    }
    /**
     * 指定されたプロバイダのAPIキーをセキュアに保存する
     * @param provider プロバイダ名 (e.g., 'openrouter', 'openai')
     * @param apiKey 保存するAPIキー
     */
    async setApiKey(provider, apiKey) {
        const account = this.getAccountForProvider(provider);
        try {
            await keytar.setPassword(SERVICE_NAME, account, apiKey);
        }
        catch (error) {
            console.error(`Failed to set API key for ${provider}:`, error);
            vscode.window.showErrorMessage(`Could not save API key for ${provider}. Your system may not support secure credential storage.`);
            // エラーを再スローして、呼び出し元でさらなる処理を可能にする
            throw error;
        }
    }
    /**
     * 指定されたプロバイダのAPIキーをセキュアに取得する
     * @param provider プロバイダ名 (e.g., 'openrouter', 'openai')
     * @returns 保存されているAPIキー。存在しない、または取得に失敗した場合はnullを返す。
     */
    async getApiKey(provider) {
        const account = this.getAccountForProvider(provider);
        try {
            return await keytar.getPassword(SERVICE_NAME, account);
        }
        catch (error) {
            console.error(`Failed to get API key for ${provider}:`, error);
            // ユーザーへの通知は、キー取得を試みるコンテキストに応じて行うべきなので、ここではログ出力に留める。
            return null;
        }
    }
    /**
     * 指定されたプロバイダのAPIキーを削除する
     * @param provider プロバイダ名 (e.g., 'openrouter', 'openai')
     * @returns 削除が成功したかどうか
     */
    async deleteApiKey(provider) {
        const account = this.getAccountForProvider(provider);
        try {
            return await keytar.deletePassword(SERVICE_NAME, account);
        }
        catch (error) {
            console.error(`Failed to delete API key for ${provider}:`, error);
            vscode.window.showErrorMessage(`Could not delete API key for ${provider}.`);
            return false;
        }
    }
}
exports.KeytarService = KeytarService;
//# sourceMappingURL=KeytarService.js.map