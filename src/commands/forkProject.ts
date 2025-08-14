// src/commands/forkProject.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { getProjectRoot } from '../utils/workspaceUtils';
import { initializeProject } from './initializeProject'; // initializeProjectを再利用するためインポート

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
        // コピー元が存在するか確認
        await fs.stat(sourceScenarioUri);
        // `scenario` ディレクトリを再帰的にコピー
        await fs.copy(sourceScenarioUri, destScenarioUri, { overwrite: true });
        console.log(`Copied 'scenario' directory from ${sourceProjectRoot.fsPath} to ${newProjectRoot.fsPath}`);
    } catch (error) {
        // コピー元に scenario がない場合は警告を出すが、処理は続行
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
            vscode.window.showWarningMessage("Source project does not contain a 'scenario' directory. A new default scenario will be created.");
        } else {
            // その他のコピーエラーは例外を投げる
            throw new Error(`Failed to copy 'scenario' directory: ${(error as Error).message}`);
        }
    }
}

/**
 * メインの実行関数
 */
export async function forkProject() {
    // 1. 現在のプロジェクトが有効か確認
    let sourceProjectRoot: vscode.Uri;
    try {
        sourceProjectRoot = await getProjectRoot();
    } catch (error) {
        vscode.window.showErrorMessage('This command must be run from within an existing Story Game project.');
        return;
    }
    
    // 2. 新しいプロジェクトの親フォルダと名前をユーザーに尋ねる
    const parentFolderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select Parent Folder for Forked Project',
        defaultUri: vscode.Uri.file(path.dirname(sourceProjectRoot.fsPath)) // 現在のプロジェクトの親をデフォルトに
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

    // 3. 汎用の初期化処理を呼び出す (ただし、UIは非表示)
    // initializeProjectはUIを持つため、ここでは直接呼び出さず、ロジックを再利用する形で実装します。
    // 今回はinitializeProjectが内部ロジックと密結合しているため、initializeProjectを直接呼び出して、後からscenarioを上書きします。
    
    // progress UIを表示しながら実行
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Forking project: ${newProjectName}`,
        cancellable: false
    }, async (progress) => {
        try {
            // a. まず、通常のプロジェクト初期化と同じ構造をすべて作成する
            progress.report({ message: 'Creating new project structure...', increment: 20 });
            
            // `initializeProject`内のファイル作成ロジックを再利用したいため、
            // ここではinitializeProjectを呼び出す代わりに、その中身を展開・修正するのが理想的ですが、
            // 簡潔さのため、一旦initializeProjectを呼び出し、その後でscenarioを上書きコピーします。
            
            // initializeProjectはUIを多く表示するため、ロジックをここに再実装します。
            const fs = vscode.workspace.fs;
            const dirs = ['scenario', 'scenario/characters', 'scenario/prompts', 'logs', 'logs/autosaves', 'logs/archives', 'exports', 'summaries'];
            for (const dir of dirs) {
                await fs.createDirectory(vscode.Uri.joinPath(newProjectRoot, dir));
            }
            // 空の設定ファイルなども作成
            const encoder = new TextEncoder();
            const settingFilePath = vscode.Uri.joinPath(newProjectRoot, '.storygamesetting.json');
            await fs.writeFile(settingFilePath, encoder.encode(`{ "llmProvider": "openrouter", "llmModel": "anthropic/claude-3.5-sonnet" }`));
            const gitignorePath = vscode.Uri.joinPath(newProjectRoot, '.gitignore');
            await fs.writeFile(gitignorePath, encoder.encode('logs/\nexports/\nsummaries/\n.vscode/\nnode_modules/'));


            // b. 既存プロジェクトから `scenario` フォルダをコピーして上書きする
            progress.report({ message: 'Copying scenario from source project...', increment: 60 });
            await copyScenarioDirectory(sourceProjectRoot, newProjectRoot);

            progress.report({ message: 'Finishing up...', increment: 20 });

            // 4. ユーザーに通知し、新しいプロジェクトを開くか尋ねる
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