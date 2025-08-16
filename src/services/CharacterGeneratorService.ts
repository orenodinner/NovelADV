// src/services/CharacterGeneratorService.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ChatMessage } from '../types';
import { getProjectRoot, readFileContent, writeFileContent, readAllFilesAsString, toSlug } from '../utils/workspaceUtils';
import { OpenRouterProvider } from '../providers/OpenRouterProvider';
import { ConfigService } from './ConfigService'; // ConfigServiceをインポート

const LOG_LENGTH_THRESHOLD_FOR_DIGEST = 15000;

export class CharacterGeneratorService {
    private static instance: CharacterGeneratorService;
    private generationPromptTemplate: string | null = null;
    private logDigestPromptTemplate: string | null = null;
    private provider: OpenRouterProvider;
    private configService: ConfigService; // ConfigServiceのインスタンスを保持

    private constructor() {
        this.provider = new OpenRouterProvider();
        this.configService = ConfigService.getInstance(); // インスタンスを取得
    }

    public static getInstance(): CharacterGeneratorService {
        if (!CharacterGeneratorService.instance) {
            CharacterGeneratorService.instance = new CharacterGeneratorService();
        }
        return CharacterGeneratorService.instance;
    }

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
     * 指定された複数の検索キーのいずれかを含むログのブロックを抽出する
     * @param fullLog - 物語の全ログ
     * @param searchKeys - 検索対象のキー（姓、名、愛称など）の配列
     * @returns フィルタリングされたログの文字列
     */
    private filterLogForCharacter(fullLog: string, searchKeys: string[]): string {
        // 各検索キーに対して正規表現オブジェクトを作成（大文字小文字を区別しない）
        const regexes = searchKeys.map(key => new RegExp(key, 'i'));
        
        const blocks = fullLog.split('\n---\n');
        const relevantBlocks = blocks.filter(block => {
            // いずれかの正規表現にマッチすればtrueを返す
            return regexes.some(regex => regex.test(block));
        });

        if (relevantBlocks.length === 0) {
            return `（検索キー [${searchKeys.join(', ')}] に一致する登場シーンが見つかりませんでした）`;
        }

        return relevantBlocks.join('\n---\n');
    }

    private async createLogDigest(longLog: string, characterName: string): Promise<string> {
        console.log(`Log is too long (${longLog.length} chars). Creating a digest for "${characterName}"...`);
        
        const { digest: template } = await this.loadPromptTemplates();
        
        const prompt = template
            .replace(/\{\{story_log\}\}/g, longLog)
            .replace(/\{\{character_name\}\}/g, characterName);

        const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

        // 要約・メタタスク用の設定を取得
        const summarizationConfig = this.configService.get().summarization;

        const result = await this.provider.chat({
            messages,
            // ログの要約なので、要約用の設定を使用
            overrideConfig: {
                ...summarizationConfig,
                temperature: 0.0,
            }
        });

        if (!result.text) {
            throw new Error('LLM returned an empty response for log digest.');
        }

        console.log(`Digest created successfully.`);
        return result.text.trim();
    }

    /**
     * 新しいキャラクターシートを生成してファイルに保存する
     * @param fullName - 作成するキャラクターのフルネーム
     * @param searchKeys - ログ検索に使用するキーの配列
     */
    public async generateCharacter(fullName: string, searchKeys: string[]): Promise<string> {
        if (!fullName || fullName.trim() === '') {
            throw new Error('Full name cannot be empty.');
        }
        if (!searchKeys || searchKeys.length === 0) {
            throw new Error('At least one search key is required.');
        }

        const projectRoot = await getProjectRoot();
        const charactersDirUri = vscode.Uri.joinPath(projectRoot, 'scenario', 'characters');
        const slugName = toSlug(fullName);
        const newCharFileUri = vscode.Uri.joinPath(charactersDirUri, `${slugName}.md`);

        try {
            await vscode.workspace.fs.stat(newCharFileUri);
            throw new Error(`Character file for "${fullName}" already exists.`);
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

        let logForGeneration = this.filterLogForCharacter(fullLog, searchKeys);

        if (logForGeneration.length > LOG_LENGTH_THRESHOLD_FOR_DIGEST) {
            logForGeneration = await this.createLogDigest(logForGeneration, fullName);
        }

        const { generation: template } = await this.loadPromptTemplates();
        
        const prompt = template
            .replace(/\{\{story_log\}\}/g, logForGeneration)
            .replace(/\{\{character_name\}\}/g, fullName);

        const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

        // 要約・メタタスク用の設定を取得
        const summarizationConfig = this.configService.get().summarization;

        const result = await this.provider.chat({
            messages,
            // キャラクターシート生成もメタタスクなので、要約用の設定を使用
            overrideConfig: {
                ...summarizationConfig,
                temperature: 0.1,
            }
        });

        if (!result.text) {
            throw new Error('LLM returned an empty response for character generation.');
        }

        await writeFileContent(newCharFileUri, result.text.trim());

        return `Successfully generated and saved character sheet for "${fullName}".`;
    }
}