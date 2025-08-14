"use strict";
// src/utils/workspaceUtils.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspaceRoot = getWorkspaceRoot;
exports.getProjectRoot = getProjectRoot;
exports.readFileContent = readFileContent;
exports.writeFileContent = writeFileContent;
exports.appendFileContent = appendFileContent;
exports.ensureDirectoryExists = ensureDirectoryExists;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const PROJECT_CONFIG_FILE = '.storygamesetting.json';
/**
 * 現在のVS CodeワークスペースのルートURIを取得します。
 * @returns {vscode.Uri} ワークスペースのルートURI
 * @throws {Error} ワークスペースが開かれていない場合にエラーをスローします。
 */
function getWorkspaceRoot() {
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
async function getProjectRoot() {
    const root = getWorkspaceRoot();
    const configUri = vscode.Uri.joinPath(root, PROJECT_CONFIG_FILE);
    try {
        await vscode.workspace.fs.stat(configUri);
        return root;
    }
    catch {
        throw new Error(`The current workspace is not a valid Story Game project. "${PROJECT_CONFIG_FILE}" not found.`);
    }
}
/**
 * 指定されたURIのファイル内容を文字列として読み込みます。
 * @param {vscode.Uri} fileUri 読み込むファイルのURI
 * @returns {Promise<string>} ファイルの内容
 * @throws {Error} ファイルの読み込みに失敗した場合にエラーをスローします。
 */
async function readFileContent(fileUri) {
    try {
        const fileContent = await vscode.workspace.fs.readFile(fileUri);
        return new TextDecoder().decode(fileContent);
    }
    catch (error) {
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
async function writeFileContent(fileUri, content) {
    try {
        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(content));
    }
    catch (error) {
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
async function appendFileContent(fileUri, content) {
    try {
        let existingContent = '';
        try {
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            existingContent = new TextDecoder().decode(fileContent);
        }
        catch (error) {
            // ファイルが存在しない場合は、existingContentは空のまま
            if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) {
                throw error;
            }
        }
        const newContent = existingContent + content;
        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(newContent));
    }
    catch (error) {
        console.error(`Failed to append to file: ${fileUri.fsPath}`, error);
        throw new Error(`Could not append to file: ${path.basename(fileUri.fsPath)}`);
    }
}
/**
 * 指定されたパスがディレクトリとして存在するか確認し、なければ作成します。
 * @param dirUri 作成するディレクトリのURI
 */
async function ensureDirectoryExists(dirUri) {
    try {
        await vscode.workspace.fs.stat(dirUri);
    }
    catch {
        // ディレクトリが存在しない場合は作成
        await vscode.workspace.fs.createDirectory(dirUri);
    }
}
//# sourceMappingURL=workspaceUtils.js.map