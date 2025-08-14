// src/pipeline/updateForeshadows.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ContextExtractor } from '../services/ContextExtractor';
import { OpenRouterProvider } from '../providers/OpenRouterProvider';
import { ChatMessage } from '../types';
import { getNovelProjectRoot, readFileContent, writeFileContent } from '../utils/workspaceUtils';
import { ConfigService } from '../services/ConfigService';

/**
 * 伏線リスト(TSV)にLLMが生成した差分パッチを適用する
 * @param originalTsv 元のTSVファイルの内容
 * @param patchTsv LLMが生成した差分パッチのTSV文字列
 * @returns 更新後のTSVファイルの内容
 */
function applyTsvPatch(originalTsv: string, patchTsv: string): string {
    const originalLines = originalTsv.split(/\r?\n/).filter(line => line.trim() !== '');
    const patchLines = patchTsv.split(/\r?\n/).filter(line => line.trim() !== '');

    if (patchLines.length === 0) {
        return originalTsv; // パッチが空なら何もしない
    }

    const header = originalLines[0];
    const headerColumns = header.split('\t');
    const idIndex = headerColumns.indexOf('id');

    if (idIndex === -1) {
        throw new Error('Original foreshadows.tsv is missing "id" column.');
    }
    
    // 既存のデータをIDをキーにしたマップに変換
    const dataMap = new Map<string, string[]>();
    for (let i = 1; i < originalLines.length; i++) {
        const columns = originalLines[i].split('\t');
        if (columns.length > idIndex) {
            dataMap.set(columns[idIndex], columns);
        }
    }

    // パッチを適用
    // パッチにヘッダーが含まれていればスキップ
    const patchStartIndex = patchLines[0].split('\t').includes('id') ? 1 : 0;
    
    for (let i = patchStartIndex; i < patchLines.length; i++) {
        const patchColumns = patchLines[i].split('\t');
        if (patchColumns.length > idIndex) {
            const id = patchColumns[idIndex];
            dataMap.set(id, patchColumns); // 既存のIDがあれば上書き、なければ追加
        }
    }

    // マップから新しいTSVを再構築
    const updatedLines = Array.from(dataMap.values()).map(columns => columns.join('\t'));
    return [header, ...updatedLines].join('\n');
}


/**
 * 伏線リストを新しい章の内容に基づいて更新する
 * @param chapterUri 更新のトリガーとなった章ファイルのURI
 */
export async function updateForeshadows(chapterUri: vscode.Uri): Promise<void> {
    try {
        vscode.window.showInformationMessage(`Updating foreshadows based on ${path.basename(chapterUri.fsPath)}...`);
        
        const contextExtractor = new ContextExtractor();
        const config = ConfigService.getInstance().get();
        const projectRoot = await getNovelProjectRoot();

        // 1. 必要なリソースを読み込む
        const [template, chapterContent, foreshadowsTsv] = await Promise.all([
            contextExtractor.getPromptTemplate('foreshadow_update'),
            readFileContent(chapterUri),
            contextExtractor.getForeshadowsTsv(),
        ]);

        if (!template) throw new Error('Foreshadow update prompt template not found.');
        
        // 2. プロンプトを構築
        const prompt = template
            .replace('{{foreshadows_tsv}}', foreshadowsTsv)
            .replace('{{chapter_content}}', chapterContent);

        const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
        
        // 3. LLMに差分パッチの生成を依頼
        const provider = new OpenRouterProvider();
        const result = await provider.chat({ messages });

        if (!result.text || result.text.trim() === '') {
            vscode.window.showInformationMessage('No foreshadow updates were suggested by the LLM.');
            return;
        }

        // 4. 差分パッチを適用
        const updatedTsv = applyTsvPatch(foreshadowsTsv, result.text);

        // 5. 更新後のTSVファイルを保存
        const foreshadowsFileUri = vscode.Uri.joinPath(projectRoot, config.paths.bible, 'foreshadows.tsv');
        await writeFileContent(foreshadowsFileUri, updatedTsv);

        vscode.window.showInformationMessage('Foreshadows list updated successfully.');

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to update foreshadows: ${error.message}`);
        console.error(error);
        throw error;
    }
}