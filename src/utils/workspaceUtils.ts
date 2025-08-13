// src/utils/workspaceUtils.ts

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * 現在のVS CodeワークスペースのルートURIを取得します。
 * @returns {vscode.Uri} ワークスペースのルートURI
 * @throws {Error} ワークスペースが開かれていない場合にエラーをスローします。
 */
export function getWorkspaceRoot(): vscode.Uri {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open. Please open your story project folder.');
    }
    return vscode.workspace.workspaceFolders[0].uri;
}

/**
 * 小説プロジェクトのルートディレクトリを特定します。
 * 現状はワークスペースルートに `.novelrc.json` があることを前提とします。
 * @returns {Promise<vscode.Uri>} 小説プロジェクトのルートURI
 * @throws {Error} プロジェクトが見つからない場合にエラーをスローします。
 */
export async function getNovelProjectRoot(): Promise<vscode.Uri> {
    const root = getWorkspaceRoot();
    const novelRcUri = vscode.Uri.joinPath(root, '.novelrc.json');
    try {
        await vscode.workspace.fs.stat(novelRcUri);
        return root;
    } catch {
        throw new Error('The current workspace is not a valid Novel Assistant project. ".novelrc.json" not found.');
    }
}

/**
 * 設定ファイル (.novelrc.json) のURIを取得します。
 * @returns {Promise<vscode.Uri>} 設定ファイルのURI
 */
export async function getNovelConfigFileUri(): Promise<vscode.Uri> {
    const projectRoot = await getNovelProjectRoot();
    return vscode.Uri.joinPath(projectRoot, '.novelrc.json');
}


/**
 * 指定されたURIのファイル内容を文字列として読み込みます。
 * @param {vscode.Uri} fileUri 読み込むファイルのURI
 * @returns {Promise<string>} ファイルの内容
 * @throws {Error} ファイルの読み込みに失敗した場合にエラーをスローします。
 */
export async function readFileContent(fileUri: vscode.Uri): Promise<string> {
    try {
        const fileContent = await vscode.workspace.fs.readFile(fileUri);
        return new TextDecoder().decode(fileContent);
    } catch (error) {
        console.error(`Failed to read file: ${fileUri.fsPath}`, error);
        throw new Error(`Could not read file: ${path.basename(fileUri.fsPath)}`);
    }
}

/**
 * 指定されたURIのファイルに文字列を書き込みます。
 * @param {vscode.Uri} fileUri 書き込むファイルのURI
 * @param {string} content 書き込む内容
 * @returns {Promise<void>}
 * @throws {Error} ファイルの書き込みに失敗した場合にエラーをスローします。
 */
export async function writeFileContent(fileUri: vscode.Uri, content: string): Promise<void> {
    try {
        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(content));
    } catch (error) {
        console.error(`Failed to write to file: ${fileUri.fsPath}`, error);
        throw new Error(`Could not write to file: ${path.basename(fileUri.fsPath)}`);
    }
}

/**
 * 指定されたパスがディレクトリとして存在するか確認し、なければ作成します。
 * @param dirUri 作成するディレクトリのURI
 */
export async function ensureDirectoryExists(dirUri: vscode.Uri): Promise<void> {
    try {
        await vscode.workspace.fs.stat(dirUri);
    } catch {
        // ディレクトリが存在しない場合は作成
        await vscode.workspace.fs.createDirectory(dirUri);
    }
}