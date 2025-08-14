// src/services/SessionManager.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ChatMessage, SessionData } from '../types';
import { StoryContextBuilder } from './StoryContextBuilder';
import { SummarizerService } from './SummarizerService';
import { getProjectRoot, readFileContent, writeFileContent, ensureDirectoryExists } from '../utils/workspaceUtils';

// --- ▼▼▼ ここから修正 ▼▼▼ ---
// ファイル冒頭の定数を削除
// --- ▲▲▲ ここまで修正 ▲▲▲ ---

export class SessionManager implements vscode.Disposable {
    private static instance: SessionManager;

    private systemPrompt: string | null = null;
    private history: ChatMessage[] = [];
    private summary: string = '';

    private contextBuilder: StoryContextBuilder;
    private summarizer: SummarizerService;

    private currentSessionFileUri: vscode.Uri | null = null;
    private isSummarizing: boolean = false;

    // --- ▼▼▼ ここから追加 ▼▼▼ ---
    // プロジェクト固有の設定を保持するプロパティ
    private shortTermMemoryTurns: number = 10; // デフォルト値
    private summarizationTriggerTurns: number = 15; // デフォルト値
    // --- ▲▲▲ ここまで追加 ▲▲▲ ---

    private constructor() {
        this.contextBuilder = new StoryContextBuilder();
        this.summarizer = SummarizerService.getInstance();
    }
    
    public dispose() {
        this.archiveCurrentSession('session_closed_');
        SessionManager.instance = undefined!;
        console.log("SessionManager disposed and session archived.");
    }

    public static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    // --- ▼▼▼ ここから新規メソッド追加 ▼▼▼ ---
    /**
     * プロジェクト設定ファイル(.storygamesetting.json)から設定を読み込む
     */
    private async loadProjectSettings(): Promise<void> {
        try {
            const projectRoot = await getProjectRoot();
            const settingFileUri = vscode.Uri.joinPath(projectRoot, '.storygamesetting.json');
            const content = await readFileContent(settingFileUri);
            const settings = JSON.parse(content);

            if (settings.context && typeof settings.context.shortTermMemoryTurns === 'number') {
                this.shortTermMemoryTurns = settings.context.shortTermMemoryTurns;
            } else {
                this.shortTermMemoryTurns = 10; // デフォルト値
            }

            if (settings.context && typeof settings.context.summarizationTriggerTurns === 'number') {
                this.summarizationTriggerTurns = settings.context.summarizationTriggerTurns;
            } else {
                this.summarizationTriggerTurns = 15; // デフォルト値
            }
            
            console.log(`Project settings loaded: shortTermMemoryTurns=${this.shortTermMemoryTurns}, summarizationTriggerTurns=${this.summarizationTriggerTurns}`);

        } catch (error) {
            console.warn("Could not load .storygamesetting.json. Using default context settings.", error);
            // ファイルが読めない場合はデフォルト値のまま継続
            this.shortTermMemoryTurns = 10;
            this.summarizationTriggerTurns = 15;
        }
    }
    // --- ▲▲▲ ここまで新規メソッド追加 ▲▲▲ ---

    private async prepareNewSessionFiles(): Promise<void> {
        try {
            const projectRoot = await getProjectRoot();
            const autoSavesDirUri = vscode.Uri.joinPath(projectRoot, 'logs', 'autosaves');
            await ensureDirectoryExists(autoSavesDirUri);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `session_${timestamp}.json`;
            this.currentSessionFileUri = vscode.Uri.joinPath(autoSavesDirUri, fileName);

            await this.updateCurrentSessionFile();
        } catch (error: any) {
            console.error("Failed to prepare new session file:", error);
            this.currentSessionFileUri = null;
        }
    }

    public async archiveCurrentSession(prefix: string = 'archive_'): Promise<void> {
        if (!this.currentSessionFileUri) return;

        try {
            const projectRoot = await getProjectRoot();
            const archivesDirUri = vscode.Uri.joinPath(projectRoot, 'logs', 'archives');
            await ensureDirectoryExists(archivesDirUri);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const newFileName = `${prefix}${timestamp}.json`;
            const archiveFileUri = vscode.Uri.joinPath(archivesDirUri, newFileName);
            
            const content = await readFileContent(this.currentSessionFileUri);
            await writeFileContent(archiveFileUri, content);

            console.log(`Session archived to ${newFileName}`);
        } catch (error: any) {
            if (!(error instanceof vscode.FileSystemError)) {
                console.error("Failed to archive session:", error);
                vscode.window.showErrorMessage(`Failed to archive session: ${error.message}`);
            }
        }
    }

    public async startNewSession(): Promise<string> {
        if (this.history.length > 0) {
            const lastMessage = this.history[this.history.length - 1];
            return lastMessage ? lastMessage.content : "セッションを再開します。";
        }

        await this.archiveCurrentSession('session_restarted_');

        // --- ▼▼▼ ここから修正 ▼▼▼ ---
        // セッション開始時にプロジェクト設定を読み込む
        await this.loadProjectSettings();
        // --- ▲▲▲ ここまで修正 ▲▲▲ ---

        this.systemPrompt = await this.contextBuilder.buildInitialSystemPrompt();
        this.history = [];
        this.summary = '';
        await this.prepareNewSessionFiles();

        const openingMessage = await this.contextBuilder.getOpeningScene();
        await this.addMessage('assistant', openingMessage);
        return openingMessage;
    }

    public async addMessage(role: 'user' | 'assistant', content: string): Promise<void> {
        this.history.push({ role, content });
        await this.updateCurrentSessionFile();

        if (role === 'assistant') {
            await this.triggerSummarizationIfNeeded();
        }
    }
    
    private async triggerSummarizationIfNeeded(): Promise<void> {
        const currentTurnCount = Math.floor(this.history.length / 2);
        
        // --- ▼▼▼ ここから修正 ▼▼▼ ---
        // ハードコードされた定数をプロパティに置き換え
        if (this.isSummarizing || currentTurnCount < this.summarizationTriggerTurns) {
            return;
        }
        // --- ▲▲▲ ここまで修正 ▲▲▲ ---

        this.isSummarizing = true;
        
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: 'AI is summarizing the story...',
            cancellable: false
        }, async () => {
            try {
                // --- ▼▼▼ ここから修正 ▼▼▼ ---
                // ハードコードされた定数をプロパティに置き換え
                const turnsToSummarize = this.history.length - (this.shortTermMemoryTurns * 2);
                // --- ▲▲▲ ここまで修正 ▲▲▲ ---
                const logToSummarize = this.history.slice(0, turnsToSummarize);
                const remainingHistory = this.history.slice(turnsToSummarize);

                if (logToSummarize.length > 0) {
                    const newSummary = await this.summarizer.summarize(this.summary, logToSummarize);
                    this.summary = newSummary;
                    this.history = remainingHistory;

                    await this.updateCurrentSessionFile();
                }
            } catch (error) {
                console.error("Summarization process failed:", error);
            } finally {
                this.isSummarizing = false;
            }
        });
    }
    
    private async updateCurrentSessionFile(): Promise<void> {
        if (!this.currentSessionFileUri) {
             if (this.history.length > 0) await this.prepareNewSessionFiles();
             return;
        }

        try {
            const sessionData: SessionData = {
                systemPrompt: this.systemPrompt,
                history: this.history,
                summary: this.summary,
            };
            await writeFileContent(this.currentSessionFileUri, JSON.stringify(sessionData, null, 2));
        } catch (error: any) {
            console.error("Failed to update current session file:", error);
        }
    }

    public getHistory(): ChatMessage[] {
        return this.history;
    }

    public getHistoryForLLM(): ChatMessage[] {
        if (!this.systemPrompt) {
            throw new Error("Session has not been started. Call startNewSession() first.");
        }
        
        const fullSystemPrompt = `
${this.systemPrompt}

---

# これまでの物語の要約
${this.summary || "物語は始まったばかりです。"}

---
ここからが現在の会話です。プレイヤーの最後の発言に応答してください。
`.trim();

        // --- ▼▼▼ ここから修正 ▼▼▼ ---
        // ハードコードされた定数をプロパティに置き換え
        const recentHistory = this.history.slice(-(this.shortTermMemoryTurns * 2));
        // --- ▲▲▲ ここまで修正 ▲▲▲ ---
        
        return [{ role: 'system', content: fullSystemPrompt }, ...recentHistory];
    }
    
    public async saveSession(): Promise<void> {
        if (this.history.length === 0 && this.summary === '') {
            vscode.window.showInformationMessage("No conversation to save.");
            return;
        }
        await this.archiveCurrentSession('manual_save_');
        vscode.window.showInformationMessage(`Current session saved to 'logs/archives'.`);
    }

    public async loadSession(): Promise<ChatMessage[] | null> {
        const projectRoot = await getProjectRoot();
        const archivesDirUri = vscode.Uri.joinPath(projectRoot, 'logs', 'archives');

        try {
            await ensureDirectoryExists(archivesDirUri);
            const allFiles = (await vscode.workspace.fs.readDirectory(archivesDirUri))
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
                .map(([name, _]) => name)
                .sort()
                .reverse();

            if (allFiles.length === 0) {
                vscode.window.showInformationMessage("No archived sessions found in 'logs/archives'.");
                return null;
            }

            const selectedFile = await vscode.window.showQuickPick(allFiles, {
                placeHolder: "Select a session to load from archives"
            });

            if (!selectedFile) return null;
            
            await this.archiveCurrentSession('session_before_load_');

            const fileUri = vscode.Uri.joinPath(archivesDirUri, selectedFile);
            const content = await readFileContent(fileUri);
            const loadedData: SessionData = JSON.parse(content);

            if (loadedData.systemPrompt && loadedData.history) {
                // --- ▼▼▼ ここから修正 ▼▼▼ ---
                // ロード時にもプロジェクト設定を再読み込みする
                await this.loadProjectSettings();
                // --- ▲▲▲ ここまで修正 ▲▲▲ ---
                
                this.systemPrompt = loadedData.systemPrompt;
                this.history = loadedData.history;
                this.summary = loadedData.summary || '';

                await this.prepareNewSessionFiles();
                await this.updateCurrentSessionFile();
                
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