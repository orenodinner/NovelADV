// src/pipeline/summarizeChapter.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ContextExtractor } from '../services/ContextExtractor';
import { OpenRouterProvider } from '../providers/OpenRouterProvider';
import { ChatMessage } from '../types';
import { getNovelProjectRoot, readFileContent, writeFileContent, ensureDirectoryExists } from '../utils/workspaceUtils';
import { ConfigService } from '../services/ConfigService';

/**
 * 章の本文から要約を生成し、summaries/ ディレクトリに保存する
 * @param chapterUri 要約対象の章ファイルのURI
 */
export async function summarizeChapter(chapterUri: vscode.Uri): Promise<void> {
    try {
        vscode.window.showInformationMessage(`Starting summarization for ${path.basename(chapterUri.fsPath)}...`);

        const contextExtractor = new ContextExtractor();
        const config = ConfigService.getInstance().get();

        // 1. 必要なリソースを並行して読み込む
        const [template, chapterContent, projectRoot] = await Promise.all([
            contextExtractor.getPromptTemplate('summarization'),
            readFileContent(chapterUri),
            getNovelProjectRoot()
        ]);

        if (!template) {
            throw new Error('Summarization prompt template not found.');
        }

        // 2. プロンプトを構築
        const prompt = template.replace('{{chapter_content}}', chapterContent);
        const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

        // 3. LLMに要約を依頼
        const provider = new OpenRouterProvider();
        const result = await provider.chat({ messages });

        if (!result.text) {
            throw new Error('LLM returned an empty summary.');
        }

        // 4. 保存先のパスを決定
        const chapterFileName = path.basename(chapterUri.fsPath);
        // "chap_01_draft.md" -> "chap_01_sum.md"
        const summaryFileName = chapterFileName.replace(/_draft(\.md)$/i, '_sum$1').replace(/\.md$/, '_sum.md');
        
        const summariesDirUri = vscode.Uri.joinPath(projectRoot, config.paths.summaries);
        await ensureDirectoryExists(summariesDirUri);

        const summaryFileUri = vscode.Uri.joinPath(summariesDirUri, summaryFileName);

        // 5. 要約をファイルに保存
        await writeFileContent(summaryFileUri, result.text);

        vscode.window.showInformationMessage(`Summary saved to ${summaryFileName}`);

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to summarize chapter: ${error.message}`);
        console.error(error);
        // エラーを再スローして、呼び出し元のProgress表示などを中断させる
        throw error;
    }
}