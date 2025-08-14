// src/services/CharacterUpdaterService.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ChatMessage } from '../types';
import { getProjectRoot, readFileContent, writeFileContent } from '../utils/workspaceUtils';
import { OpenRouterProvider } from '../providers/OpenRouterProvider';

export class CharacterUpdaterService {
    private static instance: CharacterUpdaterService;
    private updatePromptTemplate: string | null = null;
    private provider: OpenRouterProvider;

    private constructor() {
        this.provider = new OpenRouterProvider();
    }

    public static getInstance(): CharacterUpdaterService {
        if (!CharacterUpdaterService.instance) {
            CharacterUpdaterService.instance = new CharacterUpdaterService();
        }
        return CharacterUpdaterService.instance;
    }

    /**
     * キャラクター更新用のプロンプトテンプレートをファイルから読み込む
     */
    private async loadPromptTemplate(): Promise<string> {
        if (this.updatePromptTemplate) {
            return this.updatePromptTemplate;
        }
        try {
            const projectRoot = await getProjectRoot();
            const promptUri = vscode.Uri.joinPath(projectRoot, 'scenario', 'prompts', 'character_update_prompt.md');
            this.updatePromptTemplate = await readFileContent(promptUri);
            return this.updatePromptTemplate;
        } catch (error) {
            vscode.window.showErrorMessage('Failed to load character update prompt template. Please ensure "scenario/prompts/character_update_prompt.md" exists.');
            throw new Error('Character update prompt template not found.');
        }
    }

    /**
     * 指定されたキャラクターファイルをAIを使って更新する
     * @param characterFileUri 更新対象のキャラクターファイルのURI
     * @param storySummary 最新の物語の要約
     */
    private async updateSingleCharacter(characterFileUri: vscode.Uri, storySummary: string): Promise<void> {
        try {
            const template = await this.loadPromptTemplate();
            const existingContent = await readFileContent(characterFileUri);

            const prompt = template
                .replace(/\{\{character_sheet\}\}/g, existingContent)
                .replace(/\{\{story_summary\}\}/g, storySummary);

            const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

            const result = await this.provider.chat({
                messages: messages,
                temperature: 0.1, // 事実に基づいた更新を促すため、創造性を低く設定
            });

            if (result.text && result.text.trim() !== existingContent.trim()) {
                await writeFileContent(characterFileUri, result.text.trim());
                console.log(`Character file updated: ${path.basename(characterFileUri.fsPath)}`);
            } else {
                console.log(`No changes needed for: ${path.basename(characterFileUri.fsPath)}`);
            }
        } catch (error) {
            console.error(`Failed to update character file ${characterFileUri.fsPath}:`, error);
            // 個別のファイル更新エラーは全体を止めないようにする
        }
    }

    /**
     * プロジェクト内のすべてのキャラクターファイルを更新する
     * @param storySummary 最新の物語の要約
     */
    public async updateAllCharacters(storySummary: string): Promise<void> {
        console.log("Starting to update all character files based on the new summary...");
        if (!storySummary || storySummary.trim() === 'まだ要約はありません。' || storySummary.trim() === '') {
            console.log("Summary is empty, skipping character updates.");
            return;
        }

        try {
            const projectRoot = await getProjectRoot();
            const charactersDirUri = vscode.Uri.joinPath(projectRoot, 'scenario', 'characters');
            
            const allFiles = await vscode.workspace.fs.readDirectory(charactersDirUri);
            
            const characterFiles = allFiles
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
                .map(([name, _]) => vscode.Uri.joinPath(charactersDirUri, name));

            if (characterFiles.length === 0) {
                console.log("No character files found to update.");
                return;
            }

            // すべてのキャラクターファイルの更新を並行して実行
            const updatePromises = characterFiles.map(fileUri => this.updateSingleCharacter(fileUri, storySummary));
            
            await Promise.all(updatePromises);

            console.log("All character files have been processed.");
            vscode.window.showInformationMessage("Character sheets have been updated based on the story's progress.");

        } catch (error) {
            // charactersディレクトリがない場合など
             if (!(error instanceof vscode.FileSystemError)) {
                console.error("An error occurred during the character update process:", error);
                vscode.window.showErrorMessage(`Failed to update character files: ${(error as Error).message}`);
             }
        }
    }
}