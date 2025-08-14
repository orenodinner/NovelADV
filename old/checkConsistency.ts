// src/pipeline/checkConsistency.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ContextExtractor } from '../services/ContextExtractor';
import { OpenRouterProvider } from '../providers/OpenRouterProvider';
import { ChatMessage } from '../types';
import { getNovelProjectRoot, readFileContent, writeFileContent, ensureDirectoryExists } from '../utils/workspaceUtils';
import { ConfigService } from '../services/ConfigService';

/**
 * 章の本文と設定資料を比較し、整合性レポートを生成して reports/ ディレクトリに保存する
 * @param chapterUri チェック対象の章ファイルのURI
 */
export async function checkConsistency(chapterUri: vscode.Uri): Promise<void> {
    try {
        vscode.window.showInformationMessage(`Running consistency check for ${path.basename(chapterUri.fsPath)}...`);

        const contextExtractor = new ContextExtractor();
        const config = ConfigService.getInstance().get();
        const projectRoot = await getNovelProjectRoot();

        // 1. 必要なリソースを並行して読み込む
        const [template, chapterContent, bibleContent] = await Promise.all([
            contextExtractor.getPromptTemplate('consistency_check'),
            readFileContent(chapterUri),
            // 整合性チェックに必要な「聖書」の内容をすべて集約する
            (async () => {
                const [chars, world, rules, timeline] = await Promise.all([
                    contextExtractor.getCharacters(),
                    contextExtractor.getWorldInfo(),
                    contextExtractor.getStyleRules(),
                    contextExtractor.getTimeline(),
                ]);
                return `
<登場人物>
${chars}
</登場人物>

<世界観ルール>
${world}
</世界観ルール>

<文体・作風ルール>
${rules}
</文体・作風ルール>

<時系列>
${timeline}
</時系列>
                `.trim();
            })(),
        ]);

        if (!template) throw new Error('Consistency check prompt template not found.');

        // 2. プロンプトを構築
        const prompt = template
            .replace('{{bible_content}}', bibleContent)
            .replace('{{chapter_content}}', chapterContent);

        const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

        // 3. LLMにレポート生成を依頼
        const provider = new OpenRouterProvider();
        const result = await provider.chat({ messages });
        
        if (!result.text) {
            throw new Error('LLM returned an empty consistency report.');
        }

        // 4. 保存先のパスを決定
        const chapterFileName = path.basename(chapterUri.fsPath);
        const reportFileName = chapterFileName.replace(/_draft(\.md)$/i, '_consistency$1').replace(/\.md$/, '_consistency.md');
        
        const reportsDirUri = vscode.Uri.joinPath(projectRoot, config.paths.reports);
        await ensureDirectoryExists(reportsDirUri);
        
        const reportFileUri = vscode.Uri.joinPath(reportsDirUri, reportFileName);

        // 5. レポートをファイルに保存
        await writeFileContent(reportFileUri, result.text);

        const openAction = 'Open Report';
        const selection = await vscode.window.showInformationMessage(
            `Consistency report saved to ${reportFileName}`,
            openAction
        );

        if (selection === openAction) {
            await vscode.window.showTextDocument(reportFileUri);
        }

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to run consistency check: ${error.message}`);
        console.error(error);
        throw error;
    }
}