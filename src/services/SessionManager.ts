// src/services/SessionManager.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ChatMessage } from '../types';
import { StoryContextBuilder } from './StoryContextBuilder';
import { getProjectRoot, readFileContent, writeFileContent, ensureDirectoryExists, appendFileContent } from '../utils/workspaceUtils';

const MAX_HISTORY_LENGTH = 20; // LLMに渡す直近の対話履歴の最大数

export class SessionManager {

    private static instance: SessionManager;

    private systemPrompt: string | null = null;
    private history: ChatMessage[] = [];
    private contextBuilder: StoryContextBuilder;
    private autoSaveFileUri: vscode.Uri | null = null;

    private constructor() { // privateに変更
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
             // 最後のメッセージを返すなど、既存のセッションを継続する
            return this.history[this.history.length - 1].content;
        }

        this.systemPrompt = await this.contextBuilder.buildInitialSystemPrompt();
        this.history = [];
        await this.prepareAutoSaveFile();
        const openingMessage = await this.contextBuilder.getOpeningScene();
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
        await this.autoSaveMessage(role, content);
    }

    /**
     * 自動保存用のMarkdownファイルを準備する
     */
    private async prepareAutoSaveFile(): Promise<void> {
        try {
            const projectRoot = await getProjectRoot();
            const storiesDirUri = vscode.Uri.joinPath(projectRoot, 'stories');
            await ensureDirectoryExists(storiesDirUri);
    
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `story_${timestamp}.md`;
            this.autoSaveFileUri = vscode.Uri.joinPath(storiesDirUri, fileName);
    
            const playerInfo = (await this.contextBuilder.buildInitialSystemPrompt())
                .split('## 主人公（プレイヤー）の情報')[1]
                .split('---')[0]
                .trim();
            
            const title = `# Story Log: ${new Date().toLocaleString()}\n\n`;
            const header = `## 主人公\n${playerInfo}\n\n---\n\n`;
            
            await writeFileContent(this.autoSaveFileUri, title + header);
            
        } catch (error: any) {
            console.error("Failed to prepare auto-save file:", error);
            vscode.window.showErrorMessage(`Failed to prepare auto-save file: ${error.message}`);
            this.autoSaveFileUri = null;
        }
    }

    /**
     * メッセージをMarkdown形式でファイルに追記する
     * @param role 
     * @param content 
     */
    private async autoSaveMessage(role: 'user' | 'assistant', content: string): Promise<void> {
        if (!this.autoSaveFileUri) return;

        try {
            const formattedMessage = role === 'user' 
                ? `**You:**\n${content}\n\n` 
                : `${content}\n\n---\n\n`;
            
            await appendFileContent(this.autoSaveFileUri, formattedMessage);

        } catch (error: any) {
            console.error("Failed to auto-save message:", error);
        }
    }

    // --- ▼▼▼ ここから追加 ▼▼▼ ---
    /**
     * 現在の対話履歴（セッション）を取得する
     * @returns {ChatMessage[]}
     */
    public getHistory(): ChatMessage[] {
        return this.history;
    }
    // --- ▲▲▲ ここまで追加 ▲▲▲ ---

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
     * 現在の対話履歴をファイルに保存する
     * @returns {Promise<void>}
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
        const fileName = `session_${timestamp}.json`;
        const fileUri = vscode.Uri.joinPath(logsDirUri, fileName);

        const dataToSave = {
            systemPrompt: this.systemPrompt,
            history: this.history,
            autoSaveFilePath: this.autoSaveFileUri?.fsPath
        };

        try {
            await writeFileContent(fileUri, JSON.stringify(dataToSave, null, 2));
            vscode.window.showInformationMessage(`Conversation saved to: ${fileName}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to save session: ${error.message}`);
        }
    }

    /**
     * 保存されたセッションファイルを読み込む
     * @returns {Promise<ChatMessage[] | null>} ロードされた対話履歴、失敗した場合はnull
     */
    public async loadSession(): Promise<ChatMessage[] | null> {
        const projectRoot = await getProjectRoot();
        const logsDirUri = vscode.Uri.joinPath(projectRoot, 'logs');

        try {
            await ensureDirectoryExists(logsDirUri);
            const allFiles = await vscode.workspace.fs.readDirectory(logsDirUri);
            const sessionFiles = allFiles
                .filter(([name, type]) => type === vscode.FileType.File && name.startsWith('session_') && name.endsWith('.json'))
                .map(([name, _]) => name)
                .sort()
                .reverse(); 

            if (sessionFiles.length === 0) {
                vscode.window.showInformationMessage("No saved sessions found.");
                return null;
            }

            const selectedFile = await vscode.window.showQuickPick(sessionFiles, {
                placeHolder: "Select a session to load"
            });

            if (!selectedFile) return null;

            const fileUri = vscode.Uri.joinPath(logsDirUri, selectedFile);
            const content = await readFileContent(fileUri);
            const loadedData = JSON.parse(content);

            if (loadedData.systemPrompt && loadedData.history && loadedData.autoSaveFilePath) {
                this.systemPrompt = loadedData.systemPrompt;
                this.history = loadedData.history;
                this.autoSaveFileUri = vscode.Uri.file(loadedData.autoSaveFilePath);
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