// src/services/SessionManager.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ChatMessage } from '../types';
import { StoryContextBuilder } from './StoryContextBuilder';
import { getProjectRoot, readFileContent, writeFileContent, ensureDirectoryExists } from '../utils/workspaceUtils';

const MAX_HISTORY_LENGTH = 20; // LLMに渡す直近の対話履歴の最大数

export class SessionManager {
    private systemPrompt: string | null = null;
    private history: ChatMessage[] = [];
    private contextBuilder: StoryContextBuilder;

    constructor() {
        this.contextBuilder = new StoryContextBuilder();
    }

    /**
     * 新しいゲームセッションを開始する
     * システムプロンプトを構築し、オープニングメッセージを取得する
     * @returns {Promise<string>} オープニングメッセージ
     */
    public async startNewSession(): Promise<string> {
        this.systemPrompt = await this.contextBuilder.buildInitialSystemPrompt();
        this.history = [];
        const openingMessage = await this.contextBuilder.getOpeningScene();
        this.addMessage('assistant', openingMessage);
        return openingMessage;
    }

    /**
     * 対話履歴にメッセージを追加する
     * @param role メッセージの役割 ('user' or 'assistant')
     * @param content メッセージの内容
     */
    public addMessage(role: 'user' | 'assistant', content: string): void {
        this.history.push({ role, content });
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
        // システムプロンプト + 直近の対話履歴
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
            history: this.history
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
            const allFiles = await vscode.workspace.fs.readDirectory(logsDirUri);
            const sessionFiles = allFiles
                .filter(([name, type]) => type === vscode.FileType.File && name.startsWith('session_') && name.endsWith('.json'))
                .map(([name, _]) => name)
                .sort()
                .reverse(); // 新しい順にソート

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

            if (loadedData.systemPrompt && loadedData.history) {
                this.systemPrompt = loadedData.systemPrompt;
                this.history = loadedData.history;
                vscode.window.showInformationMessage(`Session loaded from ${selectedFile}`);
                return this.history;
            } else {
                throw new Error("Invalid session file format.");
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to load session: ${error.message}`);
            return null;
        }
    }
}