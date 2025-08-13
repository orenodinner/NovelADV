"use strict";
// src/commands/runConsistencyChecks.ts
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
exports.runConsistencyChecksForCurrentChapter = runConsistencyChecksForCurrentChapter;
const vscode = __importStar(require("vscode"));
const checkConsistency_1 = require("../pipeline/checkConsistency");
/**
 * 現在アクティブな章ファイルに対して整合性チェックを実行する
 */
async function runConsistencyChecksForCurrentChapter() {
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
            await (0, checkConsistency_1.checkConsistency)(document.uri);
        }
        catch (error) {
            // エラーはcheckConsistency内で処理されるが、念のためここでもキャッチ
            vscode.window.showErrorMessage(`Consistency check command failed: ${error.message}`);
        }
    });
}
//# sourceMappingURL=runConsistencyChecks.js.map