// src/webview/ChatPanel.ts

import * as vscode from 'vscode';
import { OpenRouterProvider } from '../providers/OpenRouterProvider';
import { KeytarService } from '../services/KeytarService';
import { getNonce } from './getNonce';
import { ChatMessage } from '../types';
import { ContextExtractor } from '../services/ContextExtractor';

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;

    public static readonly viewType = 'novel-assistant.chatView';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            ChatPanel.viewType,
            'Novel Assistant Chat',
            column || vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            message => this._handleDidReceiveMessage(message),
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

    private async _handleDidReceiveMessage(message: any) {
        switch (message.command) {
            case 'user-message':
                this.handleUserMessage(message.text);
                return;
            // 'request-api-key-setup' は直接は使われないが、将来のために残す
            case 'request-api-key-setup':
                this.setupApiKey();
                return;
            case 'alert':
                vscode.window.showErrorMessage(message.text);
                return;
        }
    }

    private async handleUserMessage(text: string) {
        try {
            this._panel.webview.postMessage({ command: 'llm-response-start' });
            
            const contextExtractor = new ContextExtractor();
            const context = await contextExtractor.buildContextForChapterGeneration();
            const template = await contextExtractor.getPromptTemplate('generation');

            const systemPrompt = template
                .replace('{{characters}}', context.characters)
                .replace('{{world}}', context.world)
                .replace('{{rules}}', context.rules)
                .replace('{{timeline}}', context.timeline)
                .replace('{{arc_map}}', context.arc_map)
                .replace('{{summaries}}', context.recent_summaries)
                .replace('{{open_foreshadows}}', context.open_foreshadows);
            
            const messages: ChatMessage[] = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ];
            
            const provider = new OpenRouterProvider();
            const result = await provider.chat({
                messages,
                onStream: (chunk) => {
                    this._panel.webview.postMessage({ command: 'llm-response-chunk', chunk });
                },
            });

            this._panel.webview.postMessage({ command: 'llm-response-end', fullText: result.text });

        } catch (error: any) {
            // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
            const errorMessage = error.message || 'An unknown error occurred.';
            
            // Webview UIにエラーを通知
            this._panel.webview.postMessage({ command: 'llm-response-error', error: errorMessage });

            // APIキー未設定のエラーを判定し、設定を促す
            if (errorMessage.includes('API key is not set')) {
                const action = await vscode.window.showWarningMessage(
                    'OpenRouter API key is not set. Please set it to use the chat.',
                    'Set API Key'
                );
                if (action === 'Set API Key') {
                    this.setupApiKey();
                }
            } else {
                // その他のエラー
                vscode.window.showErrorMessage(`Error during chapter generation: ${errorMessage}`);
            }
            // --- ▲▲▲ ここまでが修正箇所 ▲▲▲ ---
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
				<title>Novel Assistant Chat</title>
			</head>
			<body>
				<div id="chat-container">
                    <div id="chat-log"></div>
                    <div id="input-container">
                        <textarea id="message-input" placeholder="執筆内容を入力... (例: 第5章 倉庫の調査)"></textarea>
                        <button id="send-button">送信</button>
                    </div>
                </div>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}