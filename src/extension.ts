// src/extension.ts

import * as vscode from 'vscode';
import { initializeProject } from './commands/initializeProject';
import { exportLogToMarkdown } from './commands/exportLogToMarkdown'; // 新規インポート
import { ChatPanel } from './webview/ChatPanel';
import { ConfigService } from './services/ConfigService';
import { KeytarService } from './services/KeytarService';
import { SessionManager } from './services/SessionManager';

/**
 * 拡張機能が有効化されたときに呼び出されるメソッド
 * @param context 拡張機能のコンテキスト
 */
export function activate(context: vscode.ExtensionContext) {

    console.log('Interactive Story Game Engine is now active!');

    // サービスを初期化
    const configService = ConfigService.getInstance();
    const keytarService = KeytarService.getInstance();
    const sessionManager = SessionManager.getInstance();
    context.subscriptions.push({ dispose: () => configService.dispose() });
    
    // コマンドの登録
    context.subscriptions.push(
        vscode.commands.registerCommand('interactive-story.initializeProject', initializeProject)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('interactive-story.openChat', () => {
            ChatPanel.createOrShow(context.extensionUri);
        })
    );

    // --- ▼▼▼ ここから追加 ▼▼▼ ---
    context.subscriptions.push(
        vscode.commands.registerCommand('interactive-story.exportLogToMarkdown', exportLogToMarkdown)
    );
    // --- ▲▲▲ ここまで追加 ▲▲▲ ---
}

/**
 * 拡張機能が無効化されるときに呼び出されるメソッド
 */
export function deactivate() {}