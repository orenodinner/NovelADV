// src/services/SessionManager.ts

import * as vscode from 'vscode';
import { ChatMessage, SessionData } from '../types';
import { StoryContextBuilder } from './StoryContextBuilder';
import { getProjectRoot, readFileContent, writeFileContent, ensureDirectoryExists } from '../utils/workspaceUtils';

const MAX_HISTORY_LENGTH = 20; // LLMに渡す直近の対話履歴の最大数

export class SessionManager {
    private static instance: SessionManager;

    private systemPrompt: string | null = null;
    private history: ChatMessage[] = [];
    private contextBuilder: StoryContextBuilder;
    // 自動保存JSONファイルのURI
    private autoSaveJsonUri: vscode.Uri | null = null;

    private constructor() {
        this.contextBuilder = new StoryContextBuilder();
    }

    public static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    /**
     * 新しいゲームセッションを開始する
     * システムプロンプトを構築し、オープニングメッセージを取得し、自動保存ファイルを準備する
     * @returns {Promise<string>} オープニングメッセージ
     */
    public async startNewSession(): Promise<string> {
        if (this.history.length > 0) {
            // 既存のセッションがあれば最後のメッセージを返す
            const lastMessage = this.history[this.history.length - 1];
            return lastMessage ? lastMessage.content : "セッションを再開します。";
        }

        this.systemPrompt = await this.contextBuilder.buildInitialSystemPrompt();
        this.history = [];
        await this.prepareAutoSave();

        const openingMessage = await this.contextBuilder.getOpeningScene();
        // 履歴に追加し、自動保存を実行
        await this.addMessage('assistant', openingMessage);
        return openingMessage;
    }

    /**
     * 対話履歴にメッセージを追加し、自動保存を実行する
     * @param role メッセージの役割 ('user' or 'assistant')
     * @param content メッセージの内容
     */
    public async addMessage(role: 'user' | 'assistant', content: string): Promise<void> {
        this.history.push({ role, content });
        // メッセージが追加されるたびにセッション全体をJSONに自動保存
        await this.autoSaveSession();
    }

    /**
     * 自動保存用のJSONファイルを準備する
     */
    private async prepareAutoSave(): Promise<void> {
        try {
            const projectRoot = await getProjectRoot();
            // 自動保存用のディレクトリを分ける
            const autoSavesDirUri = vscode.Uri.joinPath(projectRoot, 'logs', 'autosaves');
            await ensureDirectoryExists(autoSavesDirUri);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `autosave_session_${timestamp}.json`;
            this.autoSaveJsonUri = vscode.Uri.joinPath(autoSavesDirUri, fileName);

            // 空のセッションデータで初期化し、ファイルを生成
            await this.autoSaveSession();

        } catch (error: any) {
            console.error("Failed to prepare auto-save file:", error);
            vscode.window.showErrorMessage(`Failed to prepare auto-save file: ${error.message}`);
            this.autoSaveJsonUri = null;
        }
    }

    /**
     * 現在のセッション状態をJSONファイルに上書き保存する
     */
    private async autoSaveSession(): Promise<void> {
        if (!this.autoSaveJsonUri) {
            // まだ自動保存ファイルが準備されていなければ準備する
            if (this.history.length > 0) {
                await this.prepareAutoSave();
            }
            return;
        };

        try {
            const sessionData: SessionData = {
                systemPrompt: this.systemPrompt,
                history: this.history,
            };
            await writeFileContent(this.autoSaveJsonUri, JSON.stringify(sessionData, null, 2));
        } catch (error: any) {
            console.error("Failed to auto-save session:", error);
            // 頻繁に発生する可能性があるため、ここではウィンドウメッセージは表示しない
        }
    }

    /**
     * 現在の対話履歴（セッション）を取得する
     * @returns {ChatMessage[]}
     */
    public getHistory(): ChatMessage[] {
        return this.history;
    }

    /**
     * LLMに渡すためのメッセージ配列を取得する
     * システムプロンプトと直近の対話履歴を結合する
     * @returns {ChatMessage[]} LLM用のメッセージ配列
     */
    public getHistoryForLLM(): ChatMessage[] {
        if (!this.systemPrompt) {
            throw new Error("Session has not been started. Call startNewSession() first.");
        }
        const recentHistory = this.history.slice(-MAX_HISTORY_LENGTH);
        return [{ role: 'system', content: this.systemPrompt }, ...recentHistory];
    }

    /**
     * 現在の対話履歴を手動でファイルに保存する
     */
    public async saveSession(): Promise<void> {
        if (this.history.length === 0) {
            vscode.window.showInformationMessage("No conversation to save.");
            return;
        }

        const projectRoot = await getProjectRoot();
        const logsDirUri = vscode.Uri.joinPath(projectRoot, 'logs');
        await ensureDirectoryExists(logsDirUri);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `manual_save_${timestamp}.json`;
        const fileUri = vscode.Uri.joinPath(logsDirUri, fileName);

        const dataToSave: SessionData = {
            systemPrompt: this.systemPrompt,
            history: this.history,
            // 自動保存ファイルのパスも一緒に保存しておく
            autoSaveJsonPath: this.autoSaveJsonUri?.fsPath
        };

        try {
            await writeFileContent(fileUri, JSON.stringify(dataToSave, null, 2));
            vscode.window.showInformationMessage(`Conversation saved to: ${fileName}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to save session: ${error.message}`);
        }
    }

    /**
     * 保存されたセッションファイルを読み込む (手動ロード)
     * @returns {Promise<ChatMessage[] | null>} ロードされた対話履歴、失敗した場合はnull
     */
    public async loadSession(): Promise<ChatMessage[] | null> {
        const projectRoot = await getProjectRoot();
        const logsDirUri = vscode.Uri.joinPath(projectRoot, 'logs');

        try {
            await ensureDirectoryExists(logsDirUri);
            const allFiles = await vscode.workspace.fs.readDirectory(logsDirUri);
            const sessionFiles = allFiles
                .filter(([name, type]) => type === vscode.FileType.File && name.startsWith('manual_save_') && name.endsWith('.json'))
                .map(([name, _]) => name)
                .sort()
                .reverse();

            if (sessionFiles.length === 0) {
                vscode.window.showInformationMessage("No saved manual sessions found.");
                return null;
            }

            const selectedFile = await vscode.window.showQuickPick(sessionFiles, {
                placeHolder: "Select a session to load"
            });

            if (!selectedFile) return null;

            const fileUri = vscode.Uri.joinPath(logsDirUri, selectedFile);
            const content = await readFileContent(fileUri);
            const loadedData: SessionData = JSON.parse(content);

            // SessionDataの形式をチェック
            if (loadedData.systemPrompt && loadedData.history) {
                this.systemPrompt = loadedData.systemPrompt;
                this.history = loadedData.history;
                
                // ロードしたセッションを新しい自動保存ファイルとして引き継ぐ
                if(loadedData.autoSaveJsonPath) {
                    this.autoSaveJsonUri = vscode.Uri.file(loadedData.autoSaveJsonPath);
                } else {
                    // 古い形式からのロードの場合、新しい自動保存ファイルを作成
                    await this.prepareAutoSave();
                }
                
                await this.autoSaveSession(); // 状態を同期
                
                vscode.window.showInformationMessage(`Session loaded from ${selectedFile}`);
                return this.history;
            } else {
                throw new Error("Invalid or old session file format.");
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to load session: ${error.message}`);
            return null;
        }
    }
}