// src/webview/ChatPanel.ts

import * as vscode from 'vscode';
import { OpenRouterProvider } from '../providers/OpenRouterProvider';
import { KeytarService } from '../services/KeytarService';
import { getNonce } from './getNonce';
import { ChatMessage } from '../types';
import { SessionManager } from '../services/SessionManager';
import { CharacterGeneratorService } from '../services/CharacterGeneratorService';
import { ConfigService } from '../services/ConfigService'; // ConfigServiceをインポート

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;

    public static readonly viewType = 'interactive-story.chatView';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private sessionManager: SessionManager;
    private characterGenerator: CharacterGeneratorService;
    private configService: ConfigService; // ConfigServiceのインスタンスを保持


    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

       
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            ChatPanel.currentPanel.restoreHistory();
            return;
        }
      
        const panel = vscode.window.createWebviewPanel(
            ChatPanel.viewType,
            'Interactive Story Chat',
            column || vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
    }
    
    private restoreHistory() {
        const history = this.sessionManager.getHistory();
        if (history && history.length > 0) {
            this._panel.webview.postMessage({ command: 'load-history', history: history });
        }
    }


    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.sessionManager = SessionManager.getInstance();
        this.characterGenerator = CharacterGeneratorService.getInstance();
        this.configService = ConfigService.getInstance(); // インスタンスを取得

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
                if (this.sessionManager.getHistory().length === 0) {
                    await this.startGame();
                } else {
                    this.restoreHistory();
                }
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

    private async handleCommand(text: string) {
        const commandText = text.substring(1).trim();
        const parts = commandText.split(/\s+/);
        const commandName = parts[0];
        const args = parts.slice(1);

        if (commandName === 'chara_add') {
            if (args.length === 0) {
                const helpMessage = `[SYSTEM] Invalid command format. Use: !chara_add Full Name`;
                this._panel.webview.postMessage({ command: 'error-message', text: helpMessage });
                return;
            }

            const fullName = args.join(' ');
            const searchKeys = [fullName, ...args];

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Generating character sheet for "${fullName}"...`,
                cancellable: false
            }, async (progress) => {
                try {
                    progress.report({ message: 'Analyzing logs...' });
                    const resultMessage = await this.characterGenerator.generateCharacter(fullName, searchKeys);
                    vscode.window.showInformationMessage(resultMessage);
                    this._panel.webview.postMessage({ command: 'assistant-message', text: `[SYSTEM] ${resultMessage}` });
                } catch (error: any) {
                    vscode.window.showErrorMessage(error.message);
                    this._panel.webview.postMessage({ command: 'error-message', text: `[SYSTEM ERROR] ${error.message}` });
                }
            });
        } else {
            const errorMessage = `Unknown command: ${commandName}`;
            vscode.window.showWarningMessage(errorMessage);
            this._panel.webview.postMessage({ command: 'error-message', text: `[SYSTEM] ${errorMessage}` });
        }
    }

    private async handleUserMessage(text: string) {
        if (text.startsWith('!')) {
            await this.handleCommand(text);
            return;
        }

        try {
            await this.sessionManager.addMessage('user', text);
            
            this._panel.webview.postMessage({ command: 'llm-response-start' });
            
            const messages = this.sessionManager.getHistoryForLLM();
            
            // チャット用の設定を取得
            const chatConfig = this.configService.get().chat;

            const provider = new OpenRouterProvider();
            const result = await provider.chat({
                messages,
                // チャット用の設定でAPIを呼び出す
                overrideConfig: chatConfig,
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
        const provider = this.configService.get().chat.provider; // 現在のチャットプロバイダを取得
        const apiKey = await vscode.window.showInputBox({
            prompt: `Enter your ${provider} API Key`,
            password: true,
            ignoreFocusOut: true,
        });

        if (apiKey) {
            try {
                const keytarService = KeytarService.getInstance();
                await keytarService.setApiKey(provider, apiKey);
                vscode.window.showInformationMessage(`${provider} API Key saved successfully. You can now send your message again.`);
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