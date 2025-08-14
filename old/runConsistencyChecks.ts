// src/commands/runConsistencyChecks.ts

import * as vscode from 'vscode';
import { checkConsistency } from '../pipeline/checkConsistency';

/**
 * 現在アクティブな章ファイルに対して整合性チェックを実行する
 */
export async function runConsistencyChecksForCurrentChapter() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showWarningMessage('No active editor. Please open a chapter file to run consistency checks.');
        return;
    }

    const document = editor.document;
    
    // 現在のファイルが 'chapters' ディレクトリ内にあるかを確認
    const chapterPathPattern = new RegExp(`[/\\\\]chapters[/\\\\].+\\.md$`);
    if (!chapterPathPattern.test(document.uri.fsPath)) {
        vscode.window.showWarningMessage('The active file does not seem to be a chapter file. Please open a file in the "chapters" directory.');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Running consistency checks...",
        cancellable: false
    }, async (progress) => {
        try {
            // パイプラインの関数を直接呼び出す
            await checkConsistency(document.uri);
        } catch (error: any) {
            // エラーはcheckConsistency内で処理されるが、念のためここでもキャッチ
            vscode.window.showErrorMessage(`Consistency check command failed: ${error.message}`);
        }
    });
}