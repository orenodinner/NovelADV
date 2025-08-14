// src/utils/workspaceUtils.ts

import * as vscode from 'vscode';
import * as path from 'path';

const PROJECT_CONFIG_FILE = '.storygamesetting.json';

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
 * ストーリーゲームプロジェクトのルートディレクトリを特定します。
 * ワークスペースルートに `.storygamesetting.json` があることを前提とします。
 * @returns {Promise<vscode.Uri>} プロジェクトのルートURI
 * @throws {Error} プロジェクトが見つからない場合にエラーをスローします。
 */
export async function getProjectRoot(): Promise<vscode.Uri> {
    const root = getWorkspaceRoot();
    const configUri = vscode.Uri.joinPath(root, PROJECT_CONFIG_FILE);
    try {
        await vscode.workspace.fs.stat(configUri);
        return root;
    } catch {
        throw new Error(`The current workspace is not a valid Story Game project. "${PROJECT_CONFIG_FILE}" not found.`);
    }
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
 * 指定されたURIのファイルに文字列を追記します。ファイルが存在しない場合は新規作成します。
 * @param {vscode.Uri} fileUri 追記するファイルのURI
 * @param {string} content 追記する内容
 * @returns {Promise<void>}
 */
export async function appendFileContent(fileUri: vscode.Uri, content: string): Promise<void> {
    try {
        let existingContent = '';
        try {
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            existingContent = new TextDecoder().decode(fileContent);
        } catch (error) {
            // ファイルが存在しない場合は、existingContentは空のまま
            if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) {
                throw error;
            }
        }
        const newContent = existingContent + content;
        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(newContent));
    } catch (error) {
        console.error(`Failed to append to file: ${fileUri.fsPath}`, error);
        throw new Error(`Could not append to file: ${path.basename(fileUri.fsPath)}`);
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