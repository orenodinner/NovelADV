// src/services/KeytarService.ts

import * as vscode from 'vscode';
// keytarはCommonJSモジュールなので、import文のスタイルを合わせる
import keytar = require('keytar');

// keytarで使用するサービス名。拡張機能で一意にする。
const SERVICE_NAME = 'vscode-interactive-story-game';

export class KeytarService {
    private static instance: KeytarService;

    private constructor() {
        // コンストラクタは空でもOK。シングルトンを強制するためにprivateにする。
    }

    public static getInstance(): KeytarService {
        if (!KeytarService.instance) {
            KeytarService.instance = new KeytarService();
        }
        return KeytarService.instance;
    }

    /**
     * プロバイダ名からkeytarで使用するアカウント名を生成する
     * @param provider プロバイダ名 (e.g., 'openrouter')
     */
    private getAccountForProvider(provider: string): string {
        return `${provider}-api-key`;
    }

    /**
     * 指定されたプロバイダのAPIキーをセキュアに保存する
     * @param provider プロバイダ名 (e.g., 'openrouter', 'openai')
     * @param apiKey 保存するAPIキー
     */
    public async setApiKey(provider: string, apiKey: string): Promise<void> {
        const account = this.getAccountForProvider(provider);
        try {
            await keytar.setPassword(SERVICE_NAME, account, apiKey);
        } catch (error) {
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
    public async getApiKey(provider: string): Promise<string | null> {
        const account = this.getAccountForProvider(provider);
        try {
            return await keytar.getPassword(SERVICE_NAME, account);
        } catch (error) {
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
    public async deleteApiKey(provider: string): Promise<boolean> {
        const account = this.getAccountForProvider(provider);
        try {
            return await keytar.deletePassword(SERVICE_NAME, account);
        } catch (error) {
            console.error(`Failed to delete API key for ${provider}:`, error);
            vscode.window.showErrorMessage(`Could not delete API key for ${provider}.`);
            return false;
        }
    }
}