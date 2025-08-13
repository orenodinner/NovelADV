"use strict";
// src/pipeline/updateForeshadows.ts
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
exports.updateForeshadows = updateForeshadows;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const ContextExtractor_1 = require("../services/ContextExtractor");
const OpenRouterProvider_1 = require("../providers/OpenRouterProvider");
const workspaceUtils_1 = require("../utils/workspaceUtils");
const ConfigService_1 = require("../services/ConfigService");
/**
 * 伏線リスト(TSV)にLLMが生成した差分パッチを適用する
 * @param originalTsv 元のTSVファイルの内容
 * @param patchTsv LLMが生成した差分パッチのTSV文字列
 * @returns 更新後のTSVファイルの内容
 */
function applyTsvPatch(originalTsv, patchTsv) {
    const originalLines = originalTsv.split(/\r?\n/).filter(line => line.trim() !== '');
    const patchLines = patchTsv.split(/\r?\n/).filter(line => line.trim() !== '');
    if (patchLines.length === 0) {
        return originalTsv; // パッチが空なら何もしない
    }
    const header = originalLines[0];
    const headerColumns = header.split('\t');
    const idIndex = headerColumns.indexOf('id');
    if (idIndex === -1) {
        throw new Error('Original foreshadows.tsv is missing "id" column.');
    }
    // 既存のデータをIDをキーにしたマップに変換
    const dataMap = new Map();
    for (let i = 1; i < originalLines.length; i++) {
        const columns = originalLines[i].split('\t');
        if (columns.length > idIndex) {
            dataMap.set(columns[idIndex], columns);
        }
    }
    // パッチを適用
    // パッチにヘッダーが含まれていればスキップ
    const patchStartIndex = patchLines[0].split('\t').includes('id') ? 1 : 0;
    for (let i = patchStartIndex; i < patchLines.length; i++) {
        const patchColumns = patchLines[i].split('\t');
        if (patchColumns.length > idIndex) {
            const id = patchColumns[idIndex];
            dataMap.set(id, patchColumns); // 既存のIDがあれば上書き、なければ追加
        }
    }
    // マップから新しいTSVを再構築
    const updatedLines = Array.from(dataMap.values()).map(columns => columns.join('\t'));
    return [header, ...updatedLines].join('\n');
}
/**
 * 伏線リストを新しい章の内容に基づいて更新する
 * @param chapterUri 更新のトリガーとなった章ファイルのURI
 */
async function updateForeshadows(chapterUri) {
    try {
        vscode.window.showInformationMessage(`Updating foreshadows based on ${path.basename(chapterUri.fsPath)}...`);
        const contextExtractor = new ContextExtractor_1.ContextExtractor();
        const config = ConfigService_1.ConfigService.getInstance().get();
        const projectRoot = await (0, workspaceUtils_1.getNovelProjectRoot)();
        // 1. 必要なリソースを読み込む
        const [template, chapterContent, foreshadowsTsv] = await Promise.all([
            contextExtractor.getPromptTemplate('foreshadow_update'),
            (0, workspaceUtils_1.readFileContent)(chapterUri),
            contextExtractor.getForeshadowsTsv(),
        ]);
        if (!template)
            throw new Error('Foreshadow update prompt template not found.');
        // 2. プロンプトを構築
        const prompt = template
            .replace('{{foreshadows_tsv}}', foreshadowsTsv)
            .replace('{{chapter_content}}', chapterContent);
        const messages = [{ role: 'user', content: prompt }];
        // 3. LLMに差分パッチの生成を依頼
        const provider = new OpenRouterProvider_1.OpenRouterProvider();
        const result = await provider.chat({ messages });
        if (!result.text || result.text.trim() === '') {
            vscode.window.showInformationMessage('No foreshadow updates were suggested by the LLM.');
            return;
        }
        // 4. 差分パッチを適用
        const updatedTsv = applyTsvPatch(foreshadowsTsv, result.text);
        // 5. 更新後のTSVファイルを保存
        const foreshadowsFileUri = vscode.Uri.joinPath(projectRoot, config.paths.bible, 'foreshadows.tsv');
        await (0, workspaceUtils_1.writeFileContent)(foreshadowsFileUri, updatedTsv);
        vscode.window.showInformationMessage('Foreshadows list updated successfully.');
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to update foreshadows: ${error.message}`);
        console.error(error);
        throw error;
    }
}
//# sourceMappingURL=updateForeshadows.js.map