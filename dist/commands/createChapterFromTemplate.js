"use strict";
// src/commands/createChapterFromTemplate.ts
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
exports.createChapterFromTemplate = createChapterFromTemplate;
const vscode = __importStar(require("vscode"));
const ConfigService_1 = require("../services/ConfigService");
const workspaceUtils_1 = require("../utils/workspaceUtils");
/**
 * 文字列をファイル名に適した形式（スラッグ）に変換する
 * 例: "始まりの日" -> "hajimari-no-hi"
 * これは簡易的な実装です。より正確な変換にはライブラリ（`slug`など）を検討します。
 * @param text 変換する文字列
 */
function toSlug(text) {
    return text
        .toLowerCase()
        .replace(/\s+/g, '-') // スペースをハイフンに
        .replace(/[^a-z0-9-]/g, ''); // 英数字とハイフン以外を削除
}
async function createChapterFromTemplate() {
    try {
        // 1. ユーザーから情報を収集
        const chapterNumberStr = await vscode.window.showInputBox({
            prompt: 'Enter the chapter number (e.g., 1, 2, 3)',
            validateInput: text => /^\d+$/.test(text) ? null : 'Please enter a valid number.'
        });
        if (!chapterNumberStr)
            return; // キャンセルされた
        const title = await vscode.window.showInputBox({
            prompt: 'Enter the chapter title',
            validateInput: text => text.trim() ? null : 'Title cannot be empty.'
        });
        if (!title)
            return;
        const purpose = await vscode.window.showInputBox({
            prompt: 'What is the main purpose of this chapter?'
        });
        if (purpose === undefined)
            return;
        const characters = await vscode.window.showInputBox({
            prompt: 'Which characters will appear? (comma-separated)'
        });
        if (characters === undefined)
            return;
        const climax = await vscode.window.showInputBox({
            prompt: 'What is the key scene or climax of this chapter?'
        });
        if (climax === undefined)
            return;
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
        const config = ConfigService_1.ConfigService.getInstance().get();
        const projectRoot = await (0, workspaceUtils_1.getNovelProjectRoot)();
        const chaptersDirUri = vscode.Uri.joinPath(projectRoot, config.paths.chapters);
        await (0, workspaceUtils_1.ensureDirectoryExists)(chaptersDirUri);
        const newChapterUri = vscode.Uri.joinPath(chaptersDirUri, fileName);
        await (0, workspaceUtils_1.writeFileContent)(newChapterUri, content.trim());
        // 4. 生成したファイルを開く
        await vscode.window.showTextDocument(newChapterUri);
        vscode.window.showInformationMessage(`Created draft for Chapter ${chapterNumber}: ${title}`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to create chapter from template: ${error.message}`);
        console.error(error);
    }
}
//# sourceMappingURL=createChapterFromTemplate.js.map