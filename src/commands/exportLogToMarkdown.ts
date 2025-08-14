// src/commands/exportLogToMarkdown.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { getProjectRoot, readFileContent, writeFileContent, ensureDirectoryExists } from '../utils/workspaceUtils';
import { SessionData, ChatMessage } from '../types';

/**
 * ユーザーにJSONログファイルを選択させる
 * @param logsRootUri ログファイルが格納されているディレクトリのURI
 * @returns 選択されたファイルのURI、または選択されなかった場合はnull
 */
async function selectLogFile(logsRootUri: vscode.Uri): Promise<vscode.Uri | null> {
    try {
        const allDirs = (await vscode.workspace.fs.readDirectory(logsRootUri))
            .filter(([name, type]) => type === vscode.FileType.Directory)
            .map(([name, _]) => name);

        // 'autosaves'とその他の手動保存ディレクトリを含める
        const logFolders = ['autosaves', ...allDirs.filter(dir => dir !== 'autosaves')];

        const selectedFolder = await vscode.window.showQuickPick(logFolders, {
            placeHolder: "Select the folder containing the log file"
        });
        if (!selectedFolder) return null;

        const targetDirUri = vscode.Uri.joinPath(logsRootUri, selectedFolder);
        const allFiles = (await vscode.workspace.fs.readDirectory(targetDirUri))
            .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
            .map(([name, _]) => name)
            .sort()
            .reverse();
        
        if (allFiles.length === 0) {
            vscode.window.showInformationMessage(`No JSON log files found in '${selectedFolder}'.`);
            return null;
        }

        const selectedFile = await vscode.window.showQuickPick(allFiles, {
            placeHolder: "Select a JSON log file to export"
        });

        return selectedFile ? vscode.Uri.joinPath(targetDirUri, selectedFile) : null;

    } catch (error) {
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
            vscode.window.showInformationMessage("The 'logs' directory does not exist yet. Play a game to create it.");
        } else {
            vscode.window.showErrorMessage(`Error accessing log files: ${(error as Error).message}`);
        }
        return null;
    }
}

/**
 * ChatMessage配列を読みやすいMarkdown形式の文字列に変換する
 * @param history 対話履歴
 * @returns Markdown形式の文字列
 */
function formatHistoryToMarkdown(history: ChatMessage[]): string {
    let markdownContent = '';
    
    history.forEach(message => {
        if (message.role === 'user') {
            markdownContent += `**You:**\n${message.content}\n\n`;
        } else if (message.role === 'assistant') {
            // アシスタントの応答は、物語の本文としてそのまま出力し、区切り線を入れる
            markdownContent += `${message.content}\n\n---\n\n`;
        }
        // 'system' メッセージは通常、対話ログには含めないため無視
    });

    return markdownContent;
}


/**
 * メインの実行関数
 */
export async function exportLogToMarkdown() {
    try {
        const projectRoot = await getProjectRoot();
        const logsRootUri = vscode.Uri.joinPath(projectRoot, 'logs');
        
        const selectedLogUri = await selectLogFile(logsRootUri);
        if (!selectedLogUri) {
            return; // ユーザーが選択をキャンセル
        }

        // 1. JSONファイルを読み込み、パースする
        const jsonContent = await readFileContent(selectedLogUri);
        const sessionData: SessionData = JSON.parse(jsonContent);

        if (!sessionData.history || sessionData.history.length === 0) {
            vscode.window.showInformationMessage("The selected log file contains no conversation history.");
            return;
        }
        
        // 2. 対話履歴をMarkdown文字列に変換する
        let markdownOutput = `# Story Log Export\n\n`;
        markdownOutput += `*Exported from: ${path.basename(selectedLogUri.fsPath)}*\n`;
        markdownOutput += `*Exported on: ${new Date().toLocaleString()}*\n\n`;
        
        // システムプロンプト（設定）もヘッダーとして追加
        if(sessionData.systemPrompt) {
            markdownOutput += `## Scenario Settings (System Prompt)\n\n`;
            markdownOutput += `\`\`\`\n${sessionData.systemPrompt}\n\`\`\`\n\n`;
        }
        
        markdownOutput += `## Story Conversation\n\n---\n\n`;
        markdownOutput += formatHistoryToMarkdown(sessionData.history);

        // 3. Markdownファイルを保存する
        const exportsDirUri = vscode.Uri.joinPath(projectRoot, 'exports');
        await ensureDirectoryExists(exportsDirUri);
        
        const originalFileName = path.basename(selectedLogUri.fsPath, '.json');
        const markdownFileName = `${originalFileName}.md`;
        const outputUri = vscode.Uri.joinPath(exportsDirUri, markdownFileName);

        await writeFileContent(outputUri, markdownOutput);

        // 4. ユーザーに通知し、ファイルを開くオプションを提供する
        const openAction = 'Open Exported File';
        const selection = await vscode.window.showInformationMessage(
            `Successfully exported log to '${markdownFileName}'.`,
            openAction
        );

        if (selection === openAction) {
            await vscode.window.showTextDocument(outputUri);
        }

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to export log to Markdown: ${error.message}`);
        console.error(error);
    }
}