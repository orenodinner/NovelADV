// src/services/SessionManager.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ChatMessage, SessionData } from '../types';
import { StoryContextBuilder } from './StoryContextBuilder';
import { SummarizerService } from './SummarizerService';
import { getProjectRoot, readFileContent, writeFileContent, ensureDirectoryExists } from '../utils/workspaceUtils';

const SHORT_TERM_MEMORY_TURNS = 10;
const SUMMARIZATION_TRIGGER_TURNS = 15;

export class SessionManager implements vscode.Disposable {
    private static instance: SessionManager;

    private systemPrompt: string | null = null;
    private history: ChatMessage[] = [];
    private summary: string = '';

    private contextBuilder: StoryContextBuilder;
    private summarizer: SummarizerService;

    // 現在のセッション状態をリアルタイムで保持するファイル
    private currentSessionFileUri: vscode.Uri | null = null;
    private isSummarizing: boolean = false;

    private constructor() {
        this.contextBuilder = new StoryContextBuilder();
        this.summarizer = SummarizerService.getInstance();
    }
    
    // シングルトンインスタンスを破棄し、バックアップ処理を呼び出す
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

    /**
     * 新しいセッション用のファイルを準備する
     */
    private async prepareNewSessionFiles(): Promise<void> {
        try {
            const projectRoot = await getProjectRoot();
            const autoSavesDirUri = vscode.Uri.joinPath(projectRoot, 'logs', 'autosaves');
            await ensureDirectoryExists(autoSavesDirUri);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `session_${timestamp}.json`;
            this.currentSessionFileUri = vscode.Uri.joinPath(autoSavesDirUri, fileName);

            // この時点では空のファイルを作成するだけ
            await this.updateCurrentSessionFile();
        } catch (error: any) {
            console.error("Failed to prepare new session file:", error);
            this.currentSessionFileUri = null;
        }
    }

    /**
     * 現在のセッションファイルをアーカイブディレクトリにコピー（バックアップ）する
     * @param prefix アーカイブファイル名のプレフィックス
     */
    public async archiveCurrentSession(prefix: string = 'archive_'): Promise<void> {
        if (!this.currentSessionFileUri) return;

        try {
            const projectRoot = await getProjectRoot();
            const archivesDirUri = vscode.Uri.joinPath(projectRoot, 'logs', 'archives');
            await ensureDirectoryExists(archivesDirUri);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const newFileName = `${prefix}${timestamp}.json`;
            const archiveFileUri = vscode.Uri.joinPath(archivesDirUri, newFileName);
            
            // fs.copyはファイルが存在しないとエラーになるため、read/writeで実装
            const content = await readFileContent(this.currentSessionFileUri);
            await writeFileContent(archiveFileUri, content);

            console.log(`Session archived to ${newFileName}`);
        } catch (error: any) {
             // ファイルが存在しないなどのエラーは無視する
            if (!(error instanceof vscode.FileSystemError)) {
                console.error("Failed to archive session:", error);
                vscode.window.showErrorMessage(`Failed to archive session: ${error.message}`);
            }
        }
    }

    public async startNewSession(): Promise<string> {
        if (this.history.length > 0) {
            // 既存のセッションがあれば最後のメッセージを返す
            const lastMessage = this.history[this.history.length - 1];
            return lastMessage ? lastMessage.content : "セッションを再開します。";
        }

        // 新しいセッションを開始する前に、古いセッションがあればアーカイブする
        await this.archiveCurrentSession('session_restarted_');

        this.systemPrompt = await this.contextBuilder.buildInitialSystemPrompt();
        this.history = [];
        this.summary = '';
        await this.prepareNewSessionFiles(); // 新しいセッションファイルを作成

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
        
        if (this.isSummarizing || currentTurnCount < SUMMARIZATION_TRIGGER_TURNS) {
            return;
        }

        this.isSummarizing = true;
        
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: 'AI is summarizing the story...',
            cancellable: false
        }, async () => {
            try {
                const turnsToSummarize = this.history.length - (SHORT_TERM_MEMORY_TURNS * 2);
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
    
    /**
     * 現在のセッション状態をファイルに上書き保存する
     */
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

        const recentHistory = this.history.slice(-(SHORT_TERM_MEMORY_TURNS * 2));
        
        return [{ role: 'system', content: fullSystemPrompt }, ...recentHistory];
    }
    
    /**
     * 手動セーブ（現在のセッションをアーカイブとして保存）
     */
    public async saveSession(): Promise<void> {
        if (this.history.length === 0 && this.summary === '') {
            vscode.window.showInformationMessage("No conversation to save.");
            return;
        }
        await this.archiveCurrentSession('manual_save_');
        vscode.window.showInformationMessage(`Current session saved to 'logs/archives'.`);
    }

    /**
     * アーカイブされたセッションファイルを読み込む
     */
    public async loadSession(): Promise<ChatMessage[] | null> {
        const projectRoot = await getProjectRoot();
        // ロード対象を archives ディレクトリに変更
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
            
            // 古いセッションをロードする前に、現在のセッションをアーカイブする
            await this.archiveCurrentSession('session_before_load_');

            const fileUri = vscode.Uri.joinPath(archivesDirUri, selectedFile);
            const content = await readFileContent(fileUri);
            const loadedData: SessionData = JSON.parse(content);

            if (loadedData.systemPrompt && loadedData.history) {
                this.systemPrompt = loadedData.systemPrompt;
                this.history = loadedData.history;
                this.summary = loadedData.summary || '';

                // ロードしたセッションを新しい「現在のセッション」として引き継ぐ
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