// src/services/CharacterGeneratorService.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ChatMessage } from '../types';
import { getProjectRoot, readFileContent, writeFileContent, readAllFilesAsString, toSlug } from '../utils/workspaceUtils';
import { OpenRouterProvider } from '../providers/OpenRouterProvider';

// 中間要約（ダイジェスト）を作成する文字数のしきい値
const LOG_LENGTH_THRESHOLD_FOR_DIGEST = 15000;

export class CharacterGeneratorService {
    private static instance: CharacterGeneratorService;
    private generationPromptTemplate: string | null = null;
    // --- ▼▼▼ ここから追加 ▼▼▼ ---
    private logDigestPromptTemplate: string | null = null;
    // --- ▲▲▲ ここまで追加 ▲▲▲ ---
    private provider: OpenRouterProvider;

    private constructor() {
        this.provider = new OpenRouterProvider();
    }

    public static getInstance(): CharacterGeneratorService {
        if (!CharacterGeneratorService.instance) {
            CharacterGeneratorService.instance = new CharacterGeneratorService();
        }
        return CharacterGeneratorService.instance;
    }

    /**
     * 各種プロンプトテンプレートをファイルから読み込む
     */
    private async loadPromptTemplates(): Promise<{ generation: string, digest: string }> {
        if (this.generationPromptTemplate && this.logDigestPromptTemplate) {
            return { generation: this.generationPromptTemplate, digest: this.logDigestPromptTemplate };
        }
        try {
            const projectRoot = await getProjectRoot();
            const generationUri = vscode.Uri.joinPath(projectRoot, 'scenario', 'prompts', 'character_generation_prompt.md');
            const digestUri = vscode.Uri.joinPath(projectRoot, 'scenario', 'prompts', 'log_digest_prompt.md');

            const [generation, digest] = await Promise.all([
                readFileContent(generationUri),
                readFileContent(digestUri)
            ]);
            
            this.generationPromptTemplate = generation;
            this.logDigestPromptTemplate = digest;
            
            return { generation, digest };
        } catch (error) {
            vscode.window.showErrorMessage('Failed to load character generation prompt templates.');
            throw new Error('Character generation prompt templates not found.');
        }
    }

    /**
     * 指定されたキャラクター名を含むログのブロックを抽出する
     */
    private filterLogForCharacter(fullLog: string, characterName: string): string {
        const blocks = fullLog.split('\n---\n');
        const relevantBlocks = blocks.filter(block => {
            const regex = new RegExp(characterName, 'i');
            return regex.test(block);
        });

        if (relevantBlocks.length === 0) {
            return '（指定されたキャラクターの登場シーンが見つかりませんでした）';
        }

        return relevantBlocks.join('\n---\n');
    }

    // --- ▼▼▼ ここから新規メソッド追加 ▼▼▼ ---
    /**
     * 長いログを中間要約（ダイジェスト）に変換する
     * @param longLog - 要約対象の長いログ
     * @param characterName - 対象キャラクター名
     * @returns 要約されたログ文字列
     */
    private async createLogDigest(longLog: string, characterName: string): Promise<string> {
        console.log(`Log is too long (${longLog.length} chars). Creating a digest for "${characterName}"...`);
        
        const { digest: template } = await this.loadPromptTemplates();
        
        const prompt = template
            .replace(/\{\{story_log\}\}/g, longLog)
            .replace(/\{\{character_name\}\}/g, characterName);

        const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

        const result = await this.provider.chat({
            messages,
            temperature: 0.0, // 事実ベースの要約のため創造性をゼロに
        });

        if (!result.text) {
            throw new Error('LLM returned an empty response for log digest.');
        }

        console.log(`Digest created successfully.`);
        return result.text.trim();
    }
    // --- ▲▲▲ ここまで新規メソッド追加 ▲▲▲ ---


    /**
     * 新しいキャラクターシートを生成してファイルに保存する
     */
    public async generateCharacter(characterName: string): Promise<string> {
        if (!characterName || characterName.trim() === '') {
            throw new Error('Character name cannot be empty.');
        }

        const projectRoot = await getProjectRoot();
        const charactersDirUri = vscode.Uri.joinPath(projectRoot, 'scenario', 'characters');
        const slugName = toSlug(characterName);
        const newCharFileUri = vscode.Uri.joinPath(charactersDirUri, `${slugName}.md`);

        try {
            await vscode.workspace.fs.stat(newCharFileUri);
            throw new Error(`Character file for "${characterName}" already exists.`);
        } catch (error) {
            if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) {
                throw error;
            }
        }
        
        const transcriptsDirUri = vscode.Uri.joinPath(projectRoot, 'logs', 'transcripts');
        const fullLog = await readAllFilesAsString(transcriptsDirUri, '.md');
        if (fullLog.trim() === '') {
            throw new Error('No story logs (transcripts) found to analyze.');
        }

        let logForGeneration = this.filterLogForCharacter(fullLog, characterName);

        // --- ▼▼▼ ここからロジック修正 ▼▼▼ ---
        // ログがしきい値より長い場合、中間要約を作成する
        if (logForGeneration.length > LOG_LENGTH_THRESHOLD_FOR_DIGEST) {
            logForGeneration = await this.createLogDigest(logForGeneration, characterName);
        }
        // --- ▲▲▲ ここまでロジック修正 ▲▲▲ ---

        const { generation: template } = await this.loadPromptTemplates();
        
        const prompt = template
            .replace(/\{\{story_log\}\}/g, logForGeneration)
            .replace(/\{\{character_name\}\}/g, characterName);

        const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

        const result = await this.provider.chat({
            messages,
            temperature: 0.1,
        });

        if (!result.text) {
            throw new Error('LLM returned an empty response for character generation.');
        }

        await writeFileContent(newCharFileUri, result.text.trim());

        return `Successfully generated and saved character sheet for "${characterName}".`;
    }
}