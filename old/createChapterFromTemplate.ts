// src/commands/createChapterFromTemplate.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigService } from '../services/ConfigService';
import { getNovelProjectRoot, writeFileContent, ensureDirectoryExists } from '../utils/workspaceUtils';

/**
 * 文字列をファイル名に適した形式（スラッグ）に変換する
 * 例: "始まりの日" -> "hajimari-no-hi"
 * これは簡易的な実装です。より正確な変換にはライブラリ（`slug`など）を検討します。
 * @param text 変換する文字列
 */
function toSlug(text: string): string {
    return text
        .toLowerCase()
        .replace(/\s+/g, '-') // スペースをハイフンに
        .replace(/[^a-z0-9-]/g, ''); // 英数字とハイフン以外を削除
}

export async function createChapterFromTemplate() {
    try {
        // 1. ユーザーから情報を収集
        const chapterNumberStr = await vscode.window.showInputBox({
            prompt: 'Enter the chapter number (e.g., 1, 2, 3)',
            validateInput: text => /^\d+$/.test(text) ? null : 'Please enter a valid number.'
        });
        if (!chapterNumberStr) return; // キャンセルされた

        const title = await vscode.window.showInputBox({
            prompt: 'Enter the chapter title',
            validateInput: text => text.trim() ? null : 'Title cannot be empty.'
        });
        if (!title) return;

        const purpose = await vscode.window.showInputBox({
            prompt: 'What is the main purpose of this chapter?'
        });
        if (purpose === undefined) return;

        const characters = await vscode.window.showInputBox({
            prompt: 'Which characters will appear? (comma-separated)'
        });
        if (characters === undefined) return;

        const climax = await vscode.window.showInputBox({
            prompt: 'What is the key scene or climax of this chapter?'
        });
        if (climax === undefined) return;

        // 2. ファイル名と内容を生成
        const chapterNumber = parseInt(chapterNumberStr, 10);
        const paddedNumber = chapterNumber.toString().padStart(2, '0');
        const slugTitle = toSlug(title);
        const fileName = `chap_${paddedNumber}_${slugTitle}_draft.md`;

        const content = `
# 第${chapterNumber}章 ${title}

## この章の目的
- ${purpose}

## 登場人物
- ${characters}

## 見せ場・クライマックス
- ${climax}

---

[ここに本文を記述]

`;

        // 3. ファイルを保存
        const config = ConfigService.getInstance().get();
        const projectRoot = await getNovelProjectRoot();
        const chaptersDirUri = vscode.Uri.joinPath(projectRoot, config.paths.chapters);
        await ensureDirectoryExists(chaptersDirUri);
        
        const newChapterUri = vscode.Uri.joinPath(chaptersDirUri, fileName);
        await writeFileContent(newChapterUri, content.trim());

        // 4. 生成したファイルを開く
        await vscode.window.showTextDocument(newChapterUri);

        vscode.window.showInformationMessage(`Created draft for Chapter ${chapterNumber}: ${title}`);

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to create chapter from template: ${error.message}`);
        console.error(error);
    }
}