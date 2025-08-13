"use strict";
// src/pipeline/checkConsistency.ts
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
exports.checkConsistency = checkConsistency;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const ContextExtractor_1 = require("../services/ContextExtractor");
const OpenRouterProvider_1 = require("../providers/OpenRouterProvider");
const workspaceUtils_1 = require("../utils/workspaceUtils");
const ConfigService_1 = require("../services/ConfigService");
/**
 * 章の本文と設定資料を比較し、整合性レポートを生成して reports/ ディレクトリに保存する
 * @param chapterUri チェック対象の章ファイルのURI
 */
async function checkConsistency(chapterUri) {
    try {
        vscode.window.showInformationMessage(`Running consistency check for ${path.basename(chapterUri.fsPath)}...`);
        const contextExtractor = new ContextExtractor_1.ContextExtractor();
        const config = ConfigService_1.ConfigService.getInstance().get();
        const projectRoot = await (0, workspaceUtils_1.getNovelProjectRoot)();
        // 1. 必要なリソースを並行して読み込む
        const [template, chapterContent, bibleContent] = await Promise.all([
            contextExtractor.getPromptTemplate('consistency_check'),
            (0, workspaceUtils_1.readFileContent)(chapterUri),
            // 整合性チェックに必要な「聖書」の内容をすべて集約する
            (async () => {
                const [chars, world, rules, timeline] = await Promise.all([
                    contextExtractor.getCharacters(),
                    contextExtractor.getWorldInfo(),
                    contextExtractor.getStyleRules(),
                    contextExtractor.getTimeline(),
                ]);
                return `
<登場人物>
${chars}
</登場人物>

<世界観ルール>
${world}
</世界観ルール>

<文体・作風ルール>
${rules}
</文体・作風ルール>

<時系列>
${timeline}
</時系列>
                `.trim();
            })(),
        ]);
        if (!template)
            throw new Error('Consistency check prompt template not found.');
        // 2. プロンプトを構築
        const prompt = template
            .replace('{{bible_content}}', bibleContent)
            .replace('{{chapter_content}}', chapterContent);
        const messages = [{ role: 'user', content: prompt }];
        // 3. LLMにレポート生成を依頼
        const provider = new OpenRouterProvider_1.OpenRouterProvider();
        const result = await provider.chat({ messages });
        if (!result.text) {
            throw new Error('LLM returned an empty consistency report.');
        }
        // 4. 保存先のパスを決定
        const chapterFileName = path.basename(chapterUri.fsPath);
        const reportFileName = chapterFileName.replace(/_draft(\.md)$/i, '_consistency$1').replace(/\.md$/, '_consistency.md');
        const reportsDirUri = vscode.Uri.joinPath(projectRoot, config.paths.reports);
        await (0, workspaceUtils_1.ensureDirectoryExists)(reportsDirUri);
        const reportFileUri = vscode.Uri.joinPath(reportsDirUri, reportFileName);
        // 5. レポートをファイルに保存
        await (0, workspaceUtils_1.writeFileContent)(reportFileUri, result.text);
        const openAction = 'Open Report';
        const selection = await vscode.window.showInformationMessage(`Consistency report saved to ${reportFileName}`, openAction);
        if (selection === openAction) {
            await vscode.window.showTextDocument(reportFileUri);
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to run consistency check: ${error.message}`);
        console.error(error);
        throw error;
    }
}
//# sourceMappingURL=checkConsistency.js.map