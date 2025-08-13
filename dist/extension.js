"use strict";
// src/extension.ts
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const initializeProject_1 = require("./commands/initializeProject");
const ChatPanel_1 = require("./webview/ChatPanel"); // これをインポー
//ト
const ConfigService_1 = require("./services/ConfigService"); // インポート
const KeytarService_1 = require("./services/KeytarService"); // インポート
const summarizeChapter_1 = require("./pipeline/summarizeChapter");
const updateForeshadows_1 = require("./pipeline/updateForeshadows"); // これをインポート
const checkConsistency_1 = require("./pipeline/checkConsistency"); // これをインポート
const createChapterFromTemplate_1 = require("./commands/createChapterFromTemplate");
const runConsistencyChecks_1 = require("./commands/runConsistencyChecks");
// ChatPanelクラスは後ほど作成します
// import { ChatPanel } from './webview/ChatPanel';
// 他のコマンドも後ほど作成・インポートします
/**
 * 拡張機能が有効化されたときに呼び出されるメソッド
 * @param context 拡張機能のコンテキスト
 */
function activate(context) {
    console.log('Novel Assistant is now active!');
    // サービスを初期化
    const configService = ConfigService_1.ConfigService.getInstance();
    const keytarService = KeytarService_1.KeytarService.getInstance();
    context.subscriptions.push({ dispose: () => configService.dispose() });
    // 1. コマンドの登録
    context.subscriptions.push(vscode.commands.registerCommand('novel-assistant.initializeProject', initializeProject_1.initializeProject));
    context.subscriptions.push(vscode.commands.registerCommand('novel-assistant.openChat', () => {
        // TODO: ChatPanelクラスを実装し、Webviewを開く
        vscode.window.showInformationMessage('Novel: Open Chat (Implementation pending)');
        // ChatPanel.createOrShow(context.extensionUri);
        ChatPanel_1.ChatPanel.createOrShow(context.extensionUri); // この行を更新
    }));
    context.subscriptions.push(vscode.commands.registerCommand('novel-assistant.createChapterFromTemplate', () => {
        // TODO: テンプレートから章を作成するウィザードを実装
        vscode.commands.registerCommand('novel-assistant.createChapterFromTemplate', createChapterFromTemplate_1.createChapterFromTemplate);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('novel-assistant.runConsistencyChecks', () => {
        // TODO: 現在の章の整合性チェックを実行
        vscode.window.showInformationMessage('Novel: Run Consistency Checks for Current Chapter');
        vscode.commands.registerCommand('novel-assistant.runConsistencyChecks', runConsistencyChecks_1.runConsistencyChecksForCurrentChapter);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('novel-assistant.rebuildForeshadowIndex', () => {
        // TODO: 伏線インデックスを再構築
        vscode.window.showInformationMessage('Novel: Rebuild Foreshadow Index');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('novel-assistant.exportReport', () => {
        // TODO: レポートをHTML形式でエクスポート
        vscode.window.showInformationMessage('Novel: Export Report (HTML)');
    }));
    // 2. 自動後処理パイプラインのトリガー設定
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
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
                    await (0, summarizeChapter_1.summarizeChapter)(document.uri);
                    if (token.isCancellationRequested) {
                        return;
                    }
                    // 2. 伏線表更新
                    progress.report({ increment: 33, message: "Updating foreshadows..." });
                    await (0, updateForeshadows_1.updateForeshadows)(document.uri);
                    if (token.isCancellationRequested) {
                        return;
                    }
                    // 3. 整合性チェック
                    progress.report({ increment: 33, message: "Checking consistency..." });
                    await (0, checkConsistency_1.checkConsistency)(document.uri); // この行を更新
                    if (token.isCancellationRequested) {
                        return;
                    }
                    progress.report({ increment: 34, message: "Completed!" });
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Post-processing failed: ${error.message}`);
                }
            });
            // --- ここまでが変更箇所 ---
        }
    }));
}
/**
 * 拡張機能が無効化されるときに呼び出されるメソッド
 */
function deactivate() { }
//# sourceMappingURL=extension.js.map