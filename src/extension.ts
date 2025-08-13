// src/extension.ts

import * as vscode from 'vscode';
import { initializeProject } from './commands/initializeProject'; 
import { ChatPanel } from './webview/ChatPanel'; // これをインポー
//ト
import { ConfigService } from './services/ConfigService'; // インポート
import { KeytarService } from './services/KeytarService'; // インポート
import { summarizeChapter } from './pipeline/summarizeChapter';
import { updateForeshadows } from './pipeline/updateForeshadows'; // これをインポート
import { checkConsistency } from './pipeline/checkConsistency'; // これをインポート
import { createChapterFromTemplate } from './commands/createChapterFromTemplate';
import { runConsistencyChecksForCurrentChapter } from './commands/runConsistencyChecks'; 

// ChatPanelクラスは後ほど作成します
// import { ChatPanel } from './webview/ChatPanel';
// 他のコマンドも後ほど作成・インポートします

/**
 * 拡張機能が有効化されたときに呼び出されるメソッド
 * @param context 拡張機能のコンテキスト
 */
export function activate(context: vscode.ExtensionContext) {

    console.log('Novel Assistant is now active!');
 

    // サービスを初期化
    const configService = ConfigService.getInstance();
    const keytarService = KeytarService.getInstance();
    context.subscriptions.push({ dispose: () => configService.dispose() });
    

    // 1. コマンドの登録
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.initializeProject', initializeProject)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.openChat', () => {
            // TODO: ChatPanelクラスを実装し、Webviewを開く
            vscode.window.showInformationMessage('Novel: Open Chat (Implementation pending)');
            // ChatPanel.createOrShow(context.extensionUri);
            ChatPanel.createOrShow(context.extensionUri); // この行を更新
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.createChapterFromTemplate', () => {
            // TODO: テンプレートから章を作成するウィザードを実装
            vscode.commands.registerCommand('novel-assistant.createChapterFromTemplate', createChapterFromTemplate)
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.runConsistencyChecks', () => {
            // TODO: 現在の章の整合性チェックを実行
            vscode.window.showInformationMessage('Novel: Run Consistency Checks for Current Chapter');
            vscode.commands.registerCommand('novel-assistant.runConsistencyChecks', runConsistencyChecksForCurrentChapter)
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.rebuildForeshadowIndex', () => {
            // TODO: 伏線インデックスを再構築
            vscode.window.showInformationMessage('Novel: Rebuild Foreshadow Index');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.exportReport', () => {
            // TODO: レポートをHTML形式でエクスポート
            vscode.window.showInformationMessage('Novel: Export Report (HTML)');
        })
    );


    // 2. 自動後処理パイプラインのトリガー設定
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
            // 保存されたファイルがchaptersディレクトリ内のmdファイルかチェック
            // パス区切り文字を正規化して判定
            const chapterPathPattern = new RegExp(`[/\\\\]chapters[/\\\\].+\\.md$`);
            if (chapterPathPattern.test(document.uri.fsPath)) {
                
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Novel Assistant: Post-processing chapter...",
                    cancellable: true
                }, async (progress, token) => {
                    
                    try {
                        // 1. 要約抽出
                        progress.report({ increment: 0, message: "Summarizing..." });
                        await summarizeChapter(document.uri);
                        if (token.isCancellationRequested) { return; }

                        // 2. 伏線表更新
                        progress.report({ increment: 33, message: "Updating foreshadows..." });
                        await updateForeshadows(document.uri);
                        if (token.isCancellationRequested) { return; }

                        // 3. 整合性チェック
                        progress.report({ increment: 33, message: "Checking consistency..." });
                        await checkConsistency(document.uri); // この行を更新
                        if (token.isCancellationRequested) { return; }

                        progress.report({ increment: 34, message: "Completed!" });
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        
                    } catch (error: any) {
                        vscode.window.showErrorMessage(`Post-processing failed: ${error.message}`);
                    }
                });
                // --- ここまでが変更箇所 ---
            }
        })
    );
}

/**
 * 拡張機能が無効化されるときに呼び出されるメソッド
 */
export function deactivate() {}