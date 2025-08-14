// src/services/SummarizerService.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ChatMessage } from '../types';
import { getProjectRoot, readFileContent } from '../utils/workspaceUtils';
import { OpenRouterProvider } from '../providers/OpenRouterProvider';

export class SummarizerService {
    private static instance: SummarizerService;
    private summarizationPromptTemplate: string | null = null;
    private provider: OpenRouterProvider;

    private constructor() {
        this.provider = new OpenRouterProvider();
    }

    public static getInstance(): SummarizerService {
        if (!SummarizerService.instance) {
            SummarizerService.instance = new SummarizerService();
        }
        return SummarizerService.instance;
    }

    /**
     * 要約生成用のプロンプトテンプレートをファイルから読み込む
     */
    private async loadPromptTemplate(): Promise<string> {
        if (this.summarizationPromptTemplate) {
            return this.summarizationPromptTemplate;
        }
        try {
            const projectRoot = await getProjectRoot();
            const promptUri = vscode.Uri.joinPath(projectRoot, 'scenario', 'prompts', 'summarization_prompt.md');
            this.summarizationPromptTemplate = await readFileContent(promptUri);
            return this.summarizationPromptTemplate;
        } catch (error) {
            vscode.window.showErrorMessage('Failed to load summarization prompt template. Please ensure "scenario/prompts/summarization_prompt.md" exists.');
            throw new Error('Summarization prompt template not found.');
        }
    }

    /**
     * 指定された対話ログをテキスト形式に変換する
     * @param logChunk 対話ログのチャンク
     * @returns テキスト形式のログ
     */
    private formatLogToText(logChunk: ChatMessage[]): string {
        return logChunk.map(msg => {
            if (msg.role === 'user') {
                return `プレイヤー: ${msg.content}`;
            } else {
                return `NPC:\n${msg.content}`;
            }
        }).join('\n\n');
    }

    /**
     * 現在の要約と新しい対話ログから、更新された要約を生成する
     * @param previousSummary これまでの要約
     * @param newLogChunk 要約対象の新しい対話ログ
     * @returns 更新された要約文字列
     */
    public async summarize(previousSummary: string, newLogChunk: ChatMessage[]): Promise<string> {
        console.log(`Summarizing ${newLogChunk.length} new messages...`);

        try {
            const template = await this.loadPromptTemplate();
            const newLogText = this.formatLogToText(newLogChunk);

            const prompt = template
                .replace('{{previous_summary}}', previousSummary || '（まだ要約はありません）')
                .replace('{{new_log}}', newLogText);

            const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

            // 要約はストリーミング不要で、より低コスト・高速なモデルを使っても良い場合がある
            const result = await this.provider.chat({
                messages: messages,
                // temperatureは低めにして、事実に基づいた要約を生成させる
                temperature: 0.2,
            });

            if (!result.text) {
                console.warn('LLM returned an empty summary. Returning previous summary.');
                return previousSummary;
            }
            
            console.log('Summarization successful.');
            return result.text.trim();

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to generate summary: ${error.message}`);
            console.error(error);
            // エラーが発生した場合は、とりあえず古い要約を返すことで処理を継続させる
            return previousSummary;
        }
    }
}