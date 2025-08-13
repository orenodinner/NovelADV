"use strict";
// src/pipeline/summarizeChapter.ts
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
exports.summarizeChapter = summarizeChapter;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const ContextExtractor_1 = require("../services/ContextExtractor");
const OpenRouterProvider_1 = require("../providers/OpenRouterProvider");
const workspaceUtils_1 = require("../utils/workspaceUtils");
const ConfigService_1 = require("../services/ConfigService");
/**
 * 章の本文から要約を生成し、summaries/ ディレクトリに保存する
 * @param chapterUri 要約対象の章ファイルのURI
 */
async function summarizeChapter(chapterUri) {
    try {
        vscode.window.showInformationMessage(`Starting summarization for ${path.basename(chapterUri.fsPath)}...`);
        const contextExtractor = new ContextExtractor_1.ContextExtractor();
        const config = ConfigService_1.ConfigService.getInstance().get();
        // 1. 必要なリソースを並行して読み込む
        const [template, chapterContent, projectRoot] = await Promise.all([
            contextExtractor.getPromptTemplate('summarization'),
            (0, workspaceUtils_1.readFileContent)(chapterUri),
            (0, workspaceUtils_1.getNovelProjectRoot)()
        ]);
        if (!template) {
            throw new Error('Summarization prompt template not found.');
        }
        // 2. プロンプトを構築
        const prompt = template.replace('{{chapter_content}}', chapterContent);
        const messages = [{ role: 'user', content: prompt }];
        // 3. LLMに要約を依頼
        const provider = new OpenRouterProvider_1.OpenRouterProvider();
        const result = await provider.chat({ messages });
        if (!result.text) {
            throw new Error('LLM returned an empty summary.');
        }
        // 4. 保存先のパスを決定
        const chapterFileName = path.basename(chapterUri.fsPath);
        // "chap_01_draft.md" -> "chap_01_sum.md"
        const summaryFileName = chapterFileName.replace(/_draft(\.md)$/i, '_sum$1').replace(/\.md$/, '_sum.md');
        const summariesDirUri = vscode.Uri.joinPath(projectRoot, config.paths.summaries);
        await (0, workspaceUtils_1.ensureDirectoryExists)(summariesDirUri);
        const summaryFileUri = vscode.Uri.joinPath(summariesDirUri, summaryFileName);
        // 5. 要約をファイルに保存
        await (0, workspaceUtils_1.writeFileContent)(summaryFileUri, result.text);
        vscode.window.showInformationMessage(`Summary saved to ${summaryFileName}`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to summarize chapter: ${error.message}`);
        console.error(error);
        // エラーを再スローして、呼び出し元のProgress表示などを中断させる
        throw error;
    }
}
//# sourceMappingURL=summarizeChapter.js.map