// src/webview/ChatPanel.ts

import * as vscode from 'vscode';
import { OpenRouterProvider } from '../providers/OpenRouterProvider';
import { KeytarService } from '../services/KeytarService';
import { getNonce } from './getNonce';
import { ChatMessage } from '../types';
import { SessionManager } from '../services/SessionManager';

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;

    public static readonly viewType = 'interactive-story.chatView';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private sessionManager: SessionManager; // SessionManagerのインスタンスを保持


    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

       
        // パネルが既に存在する場合、再表示して最新の履歴を送信する
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            ChatPanel.currentPanel.restoreHistory(); // 履歴を復元するメソッドを呼び出す
            return;
        }
      
        const panel = vscode.window.createWebviewPanel(
            ChatPanel.viewType,
            'Interactive Story Chat',
            column || vscode.ViewColumn.Two,
            {
                enableScripts: true,
                // --- ▼▼▼ ここから追加 ▼▼▼ ---
                // 非表示になってもWebviewの状態を維持する
                retainContextWhenHidden: true,
                // --- ▲▲▲ ここまで追加 ▲▲▲ ---
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
    }
    
    // --- ▼▼▼ ここから追加 ▼▼▼ ---
    /**
     * Webviewに現在の対話履歴を送信してUIを復元させる
     */
    private restoreHistory() {
        const history = this.sessionManager.getHistory(); // SessionManagerに現在の履歴を取得するメソッドを追加する必要がある
        if (history && history.length > 0) {
            this._panel.webview.postMessage({ command: 'load-history', history: history });
        }
    }
    // --- ▲▲▲ ここまで追加 ▲▲▲ ---


    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
         this.sessionManager = SessionManager.getInstance(); // シングルトンインスタンスを取得

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        this._panel.webview.onDidReceiveMessage(
            message => this._handleWebviewMessage(message),
            null,
            this._disposables
        );
    }

    public dispose() {
        ChatPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _handleWebviewMessage(message: any) {
        switch (message.command) {
            case 'webview-ready':
                // --- ▼▼▼ ここから修正 ▼▼▼ ---
                // 履歴が空の場合のみ新規ゲーム開始、そうでなければ履歴を復元
                if (this.sessionManager.getHistory().length === 0) {
                    await this.startGame();
                } else {
                    this.restoreHistory();
                }
                // --- ▲▲▲ ここまで修正 ▲▲▲ ---
                return;
            case 'user-message':
                await this.handleUserMessage(message.text);
                return;
            case 'save-game':
                await this.sessionManager.saveSession();
                return;
            case 'load-game':
                await this.loadGame();
                return;
            case 'setup-api-key':
                await this.setupApiKey();
                return;
        }
    }

    private async startGame() {
        try {
            const openingMessage = await this.sessionManager.startNewSession();
            this._panel.webview.postMessage({ command: 'assistant-message', text: openingMessage });
        } catch (error: any) {
            this._panel.webview.postMessage({ command: 'error-message', text: `Failed to start game: ${error.message}` });
        }
    }
    
    private async loadGame() {
        const history = await this.sessionManager.loadSession();
        if (history) {
            this._panel.webview.postMessage({ command: 'load-history', history: history });
        }
    }

    private async handleUserMessage(text: string) {
        try {
            await this.sessionManager.addMessage('user', text);
            
            this._panel.webview.postMessage({ command: 'llm-response-start' });
            
            const messages = this.sessionManager.getHistoryForLLM();
            
            const provider = new OpenRouterProvider();
            const result = await provider.chat({
                messages,
                onStream: (chunk) => {
                    this._panel.webview.postMessage({ command: 'llm-response-chunk', chunk });
                },
            });

            await this.sessionManager.addMessage('assistant', result.text);
            
            this._panel.webview.postMessage({ command: 'llm-response-end', fullText: result.text });

        } catch (error: any) {
            const errorMessage = error.message || 'An unknown error occurred.';
            this._panel.webview.postMessage({ command: 'llm-response-error', error: errorMessage });

            if (errorMessage.includes('API key is not set')) {
                this._panel.webview.postMessage({ command: 'request-api-key' });
            } else {
                vscode.window.showErrorMessage(`Error during story generation: ${errorMessage}`);
            }
        }
    }

    private async setupApiKey() {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your OpenRouter API Key',
            password: true,
            ignoreFocusOut: true,
        });

        if (apiKey) {
            try {
                const keytarService = KeytarService.getInstance();
                await keytarService.setApiKey('openrouter', apiKey);
                vscode.window.showInformationMessage('OpenRouter API Key saved successfully. You can now send your message again.');
                this._panel.webview.postMessage({ command: 'api-key-set-success' });
            } catch (error) {
                vscode.window.showErrorMessage('Failed to save API key.');
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
        
        const nonce = getNonce();

        return `<!DOCTYPE html>
			<html lang="ja">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
				<title>Interactive Story Chat</title>
			</head>
			<body>
				<div id="chat-container">
                    <div id="chat-log"></div>
                    <div id="input-container">
                        <textarea id="message-input" placeholder="あなたの行動や発言を入力..."></textarea>
                        <button id="send-button">送信</button>
                    </div>
                    <div id="button-bar">
                         <button id="save-button">セーブ</button>
                         <button id="load-button">ロード</button>
                    </div>
                </div>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}