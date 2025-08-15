// src/commands/forkProject.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { getProjectRoot } from '../utils/workspaceUtils';

/**
 * 既存のプロジェクトから `scenario` フォルダを新しいプロジェクトにコピーする
 * @param sourceProjectRoot コピー元のプロジェクトルートURI
 * @param newProjectRoot コピー先のプロジェクトルートURI
 */
async function copyScenarioDirectory(sourceProjectRoot: vscode.Uri, newProjectRoot: vscode.Uri) {
    const fs = vscode.workspace.fs;
    const sourceScenarioUri = vscode.Uri.joinPath(sourceProjectRoot, 'scenario');
    const destScenarioUri = vscode.Uri.joinPath(newProjectRoot, 'scenario');

    try {
        await fs.stat(sourceScenarioUri);
        await fs.copy(sourceScenarioUri, destScenarioUri, { overwrite: true });
        console.log(`Copied 'scenario' directory from ${sourceProjectRoot.fsPath} to ${newProjectRoot.fsPath}`);
    } catch (error) {
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
            vscode.window.showWarningMessage("Source project does not contain a 'scenario' directory. A new default scenario will be created.");
        } else {
            throw new Error(`Failed to copy 'scenario' directory: ${(error as Error).message}`);
        }
    }
}

/**
 * 新規プロジェクトに必要なデフォルトファイルを作成する
 * @param newProjectRoot 新しいプロジェクトのルートURI
 */
async function createDefaultFiles(newProjectRoot: vscode.Uri) {
    const fs = vscode.workspace.fs;
    const encoder = new TextEncoder();

    const settingFileContent = `{
  "$schema": "https://example.com/storygamesetting.schema.json",
  "llmProvider": "openrouter",
  "llmModel": "anthropic/claude-3.5-sonnet",
  "context": {
    "shortTermMemoryMessages": 10,
    "summarizationTriggerMessages": 20
  }
}`;
    const settingFilePath = vscode.Uri.joinPath(newProjectRoot, '.storygamesetting.json');
    await fs.writeFile(settingFilePath, encoder.encode(settingFileContent));
    
    const gitignoreContent = 'logs/\nexports/\nsummaries/\n.vscode/\nnode_modules/';
    const gitignorePath = vscode.Uri.joinPath(newProjectRoot, '.gitignore');
    await fs.writeFile(gitignorePath, encoder.encode(gitignoreContent));
    
    const summaryFileContent = `{
  "summary": "まだ要約はありません。"
}`;
    const summaryFilePath = vscode.Uri.joinPath(newProjectRoot, 'summaries', 'latest_summary.json');
    await fs.writeFile(summaryFilePath, encoder.encode(summaryFileContent));
}

/**
 * メインの実行関数
 */
export async function forkProject() {
    let sourceProjectRoot: vscode.Uri;
    try {
        sourceProjectRoot = await getProjectRoot();
    } catch (error) {
        vscode.window.showErrorMessage('This command must be run from within an existing Story Game project.');
        return;
    }
    
    const parentFolderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select Parent Folder for Forked Project',
        defaultUri: vscode.Uri.file(path.dirname(sourceProjectRoot.fsPath))
    });

    if (!parentFolderUri || parentFolderUri.length === 0) {
        vscode.window.showInformationMessage('Fork project cancelled.');
        return;
    }

    const newProjectName = await vscode.window.showInputBox({
        prompt: 'Enter the name for the new forked project',
        value: `${path.basename(sourceProjectRoot.fsPath)}-fork`
    });

    if (!newProjectName) {
        vscode.window.showInformationMessage('Fork project cancelled.');
        return;
    }

    const newProjectRoot = vscode.Uri.joinPath(parentFolderUri[0], newProjectName);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Forking project: ${newProjectName}`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: 'Creating new project structure...', increment: 20 });
            
            const fs = vscode.workspace.fs;
            // --- ▼▼▼ ここから修正 ▼▼▼ ---
            const dirs = [
                'scenario', 
                'scenario/characters', 
                'scenario/prompts', 
                'logs', 
                'logs/autosaves', 
                'logs/archives', 
                'logs/transcripts', // トランスクリプト用ディレクトリを追加
                'exports', 
                'summaries'
            ];
            // --- ▲▲▲ ここまで修正 ▲▲▲ ---
            for (const dir of dirs) {
                await fs.createDirectory(vscode.Uri.joinPath(newProjectRoot, dir));
            }
            
            await createDefaultFiles(newProjectRoot);

            progress.report({ message: 'Copying scenario from source project...', increment: 60 });
            await copyScenarioDirectory(sourceProjectRoot, newProjectRoot);

            progress.report({ message: 'Finishing up...', increment: 20 });

            const openFolder = await vscode.window.showInformationMessage(
                `Project '${newProjectName}' forked successfully!`,
                'Open Forked Project'
            );
            if (openFolder === 'Open Forked Project') {
                await vscode.commands.executeCommand('vscode.openFolder', newProjectRoot, { forceNewWindow: true });
            }

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to fork project: ${error.message}`);
            console.error(error);
        }
    });
}