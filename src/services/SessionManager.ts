// src/services/SessionManager.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ChatMessage, SessionData } from '../types';
import { StoryContextBuilder } from './StoryContextBuilder';
import { SummarizerService } from './SummarizerService';
import { CharacterUpdaterService } from './CharacterUpdaterService';
import { getProjectRoot, readFileContent, writeFileContent, ensureDirectoryExists, appendFileContent } from '../utils/workspaceUtils';

export class SessionManager implements vscode.Disposable {
    private static instance: SessionManager;

    private systemPrompt: string | null = null;
    private history: ChatMessage[] = [];
    private summary: string = '';

    private contextBuilder: StoryContextBuilder;
    private summarizer: SummarizerService;
    private characterUpdater: CharacterUpdaterService;

    private currentSessionFileUri: vscode.Uri | null = null;
    private transcriptFileUri: vscode.Uri | null = null;
    private isSummarizing: boolean = false;
    
    private shortTermMemoryMessages: number = 10;
    private summarizationTriggerMessages: number = 20;

    private constructor() {
        this.contextBuilder = new StoryContextBuilder();
        this.summarizer = SummarizerService.getInstance();
        this.characterUpdater = CharacterUpdaterService.getInstance();
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

    private async loadProjectSettings(): Promise<void> {
        // (このメソッドに変更はありません)
        try {
            const projectRoot = await getProjectRoot();
            const settingFileUri = vscode.Uri.joinPath(projectRoot, '.storygamesetting.json');
            const content = await readFileContent(settingFileUri);
            const settings = JSON.parse(content);

            if (settings.context && typeof settings.context.shortTermMemoryMessages === 'number') {
                this.shortTermMemoryMessages = settings.context.shortTermMemoryMessages;
            } else {
                this.shortTermMemoryMessages = 10;
            }

            if (settings.context && typeof settings.context.summarizationTriggerMessages === 'number') {
                this.summarizationTriggerMessages = settings.context.summarizationTriggerMessages;
            } else {
                this.summarizationTriggerMessages = 20;
            }
            
            console.log(`Project settings loaded: shortTermMemoryMessages=${this.shortTermMemoryMessages}, summarizationTriggerMessages=${this.summarizationTriggerMessages}`);

        } catch (error) {
            console.warn("Could not load .storygamesetting.json. Using default context settings.", error);
            this.shortTermMemoryMessages = 10;
            this.summarizationTriggerMessages = 20;
        }
    }
    
    private async updateLatestSummaryFile(): Promise<void> {
        // (このメソッドに変更はありません)
        try {
            const projectRoot = await getProjectRoot();
            const summaryFileUri = vscode.Uri.joinPath(projectRoot, 'summaries', 'latest_summary.json');
            const content = {
                summary: this.summary || 'まだ要約はありません。',
                updatedAt: new Date().toISOString()
            };
            await writeFileContent(summaryFileUri, JSON.stringify(content, null, 2));
        } catch (error) {
            console.error("Failed to update latest_summary.json", error);
        }
    }

    private async prepareNewSessionFiles(): Promise<void> {
        // (このメソッドに変更はありません)
        try {
            const projectRoot = await getProjectRoot();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

            const autoSavesDirUri = vscode.Uri.joinPath(projectRoot, 'logs', 'autosaves');
            await ensureDirectoryExists(autoSavesDirUri);
            const sessionFileName = `session_${timestamp}.json`;
            this.currentSessionFileUri = vscode.Uri.joinPath(autoSavesDirUri, sessionFileName);
            await this.updateCurrentSessionFile();

            const transcriptsDirUri = vscode.Uri.joinPath(projectRoot, 'logs', 'transcripts');
            await ensureDirectoryExists(transcriptsDirUri);
            const transcriptFileName = `transcript_${timestamp}.md`;
            this.transcriptFileUri = vscode.Uri.joinPath(transcriptsDirUri, transcriptFileName);

            const header = `# Story Transcript\n\n- **Session Started:** ${new Date().toLocaleString()}\n- **Project:** ${path.basename(projectRoot.fsPath)}\n\n---\n\n`;
            await writeFileContent(this.transcriptFileUri, header);

        } catch (error: any) {
            console.error("Failed to prepare new session files:", error);
            this.currentSessionFileUri = null;
            this.transcriptFileUri = null;
        }
    }
    
    private async appendToTranscript(role: 'user' | 'assistant' | 'system', content: string): Promise<void> {
        // (このメソッドに変更はありません)
        if (!this.transcriptFileUri) return;

        try {
            let formattedMessage: string;
            if (role === 'user') {
                formattedMessage = `**You:**\n${content}\n\n`;
            } else if (role === 'assistant') {
                if (this.history.length === 1) {
                     formattedMessage = `**Opening Scene:**\n${content}\n\n---\n\n`;
                } else {
                     formattedMessage = `${content}\n\n---\n\n`;
                }
            } else { // system
                formattedMessage = `*[SYSTEM: ${new Date().toLocaleTimeString()}]*\n*${content}*\n\n---\n\n`;
            }
            await appendFileContent(this.transcriptFileUri, formattedMessage);
        } catch (error) {
            console.error("Failed to append to transcript:", error);
        }
    }

    public async archiveCurrentSession(prefix: string = 'archive_'): Promise<void> {
        // (このメソッドに変更はありません)
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
        // (このメソッドに変更はありません)
        if (this.history.length > 0) {
            const lastMessage = this.history[this.history.length - 1];
            return lastMessage ? lastMessage.content : "セッションを再開します。";
        }

        await this.archiveCurrentSession('session_restarted_');
        
        await this.loadProjectSettings();

        this.systemPrompt = await this.contextBuilder.buildInitialSystemPrompt();
        this.history = [];
        this.summary = '';
        await this.prepareNewSessionFiles();
        await this.updateLatestSummaryFile();

        const openingMessage = await this.contextBuilder.getOpeningScene();
        await this.addMessage('assistant', openingMessage);
        return openingMessage;
    }

    public async addMessage(role: 'user' | 'assistant', content: string): Promise<void> {
        // (このメソッドに変更はありません)
        this.history.push({ role, content });
        await this.updateCurrentSessionFile();
        await this.appendToTranscript(role, content);
        await this.triggerSummarizationIfNeeded();
    }
    
    private async triggerSummarizationIfNeeded(): Promise<void> {
        // (このメソッドに変更はありません)
        if (this.isSummarizing || this.history.length < this.summarizationTriggerMessages) {
            return;
        }

        this.isSummarizing = true;
        console.log(`[Summarizer] Triggered at ${this.history.length} messages. Summarizing...`);
        
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Updating Story Memory...',
            cancellable: false
        }, async (progress) => {
            try {
                const sliceIndex = this.history.length > this.shortTermMemoryMessages ? this.history.length - this.shortTermMemoryMessages : 0;
                
                const logToSummarize = this.history.slice(0, sliceIndex);
                const remainingHistory = this.history.slice(sliceIndex);

                if (logToSummarize.length > 0) {
                    progress.report({ message: 'Summarizing recent events...', increment: 50 });
                    const newSummary = await this.summarizer.summarize(this.summary, logToSummarize);
                    
                    this.summary = newSummary;
                    this.history = remainingHistory;
                    
                    console.log("[Summarizer] New summary generated. History count reduced to:", this.history.length);

                    await this.updateCurrentSessionFile();
                    await this.updateLatestSummaryFile();

                    progress.report({ message: 'Updating character sheets...', increment: 50 });
                    await this.characterUpdater.updateAllCharacters(newSummary);
                } else {
                     console.log("[Summarizer] No logs to summarize, skipping.");
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error during story memory update: ${error.message}`);
                console.error("Summarization/Update process failed:", error);
            } finally {
                this.isSummarizing = false;
                console.log("[Summarizer] Process finished.");
            }
        });
    }
    
    private async updateCurrentSessionFile(): Promise<void> {
        // (このメソッドに変更はありません)
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
        // (このメソッドに変更はありません)
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

        const recentHistory = this.history.slice(-this.shortTermMemoryMessages);
        
        return [{ role: 'system', content: fullSystemPrompt }, ...recentHistory];
    }
    
    public async saveSession(): Promise<void> {
        // (このメソッドに変更はありません)
        if (this.history.length === 0 && this.summary === '') {
            vscode.window.showInformationMessage("No conversation to save.");
            return;
        }
        await this.archiveCurrentSession('manual_save_');
        vscode.window.showInformationMessage(`Current session saved to 'logs/archives'.`);
    }

    /**
     * 【新規】指定されたURIのファイルからセッションを読み込む内部メソッド
     */
    private async _loadSessionFromFile(fileUri: vscode.Uri): Promise<ChatMessage[]> {
        const content = await readFileContent(fileUri);
        const loadedData: SessionData = JSON.parse(content);

        if (loadedData.systemPrompt && loadedData.history) {
            await this.loadProjectSettings();
            
            this.systemPrompt = loadedData.systemPrompt;
            this.history = loadedData.history;
            this.summary = loadedData.summary || '';

            await this.prepareNewSessionFiles(); // ロード後に新しいオートセーブファイルを作成
            await this.updateCurrentSessionFile();
            await this.updateLatestSummaryFile();
            
            console.log(`Session loaded from ${path.basename(fileUri.fsPath)}`);
            return this.history;
        } else {
            throw new Error("Invalid or old session file format.");
        }
    }

    /**
     * 【新規】手動・自動セーブから最新のファイルを探す
     */
    private async findLatestSaveFileUri(): Promise<vscode.Uri | null> {
        const projectRoot = await getProjectRoot();
        const archivesDirUri = vscode.Uri.joinPath(projectRoot, 'logs', 'archives');
        const autosavesDirUri = vscode.Uri.joinPath(projectRoot, 'logs', 'autosaves');
        
        let allSaveFiles: { uri: vscode.Uri, name: string }[] = [];

        for (const dirUri of [archivesDirUri, autosavesDirUri]) {
            try {
                await ensureDirectoryExists(dirUri);
                const files = await vscode.workspace.fs.readDirectory(dirUri);
                const jsonFiles = files
                    .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
                    .map(([name, _]) => ({ uri: vscode.Uri.joinPath(dirUri, name), name }));
                allSaveFiles.push(...jsonFiles);
            } catch (error) {
                console.warn(`Could not read directory ${dirUri.fsPath}`, error);
            }
        }

        if (allSaveFiles.length === 0) {
            return null;
        }

        // ファイル名（タイムスタンプ順）でソートして最新のものを取得
        allSaveFiles.sort((a, b) => b.name.localeCompare(a.name));
        
        return allSaveFiles[0].uri;
    }

    /**
     * 【新規】最新のセーブデータを自動で読み込む
     */
    public async loadLatestSession(): Promise<ChatMessage[] | null> {
        try {
            const latestFileUri = await this.findLatestSaveFileUri();
            if (latestFileUri) {
                vscode.window.showInformationMessage(`Loading latest save: ${path.basename(latestFileUri.fsPath)}`);
                await this.archiveCurrentSession('session_before_load_');
                return await this._loadSessionFromFile(latestFileUri);
            }
            return null;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to auto-load latest session: ${error.message}`);
            return null;
        }
    }

    /**
     * 【修正】手動でセッションを読み込む（内部で_loadSessionFromFileを使用）
     */
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
            const history = await this._loadSessionFromFile(fileUri);
            vscode.window.showInformationMessage(`Session loaded from ${selectedFile}`);
            return history;

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to load session: ${error.message}`);
            return null;
        }
    }

    public async undoLastTurn(): Promise<{ success: boolean; message: string }> {
        // (このメソッドに変更はありません)
        if (this.history.length < 2) {
            return { success: false, message: "Cannot undo. Not enough history." };
        }

        const lastMessage = this.history[this.history.length - 1];
        const secondLastMessage = this.history[this.history.length - 2];

        if (lastMessage.role === 'assistant' && secondLastMessage.role === 'user') {
            this.history.pop();
            this.history.pop();

            await this.updateCurrentSessionFile();
            await this.appendToTranscript('system', '[UNDO] The last user message and AI response have been removed.');
            
            console.log("Last turn undone. History count:", this.history.length);
            return { success: true, message: "Last turn has been undone." };
        } else {
            return { success: false, message: "Cannot undo. The last action was not a complete user-AI turn." };
        }
    }
}