"use strict";
// src/services/ContextExtractor.ts
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
exports.ContextExtractor = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const ConfigService_1 = require("./ConfigService");
const workspaceUtils_1 = require("../utils/workspaceUtils");
class ContextExtractor {
    constructor() {
        this.projectRoot = null;
        this.config = ConfigService_1.ConfigService.getInstance().get();
    }
    /**
     * プロジェクトルートURIをキャッシュしつつ取得する
     */
    async ensureProjectRoot() {
        if (!this.projectRoot) {
            this.projectRoot = await (0, workspaceUtils_1.getNovelProjectRoot)();
        }
        return this.projectRoot;
    }
    /**
     * プロジェクトルートからの相対パスでファイル内容を取得するヘルパー
     * @param relativePath プロジェクトルートからの相対パス
     */
    async getFileContent(relativePath) {
        try {
            const root = await this.ensureProjectRoot();
            const fileUri = vscode.Uri.joinPath(root, relativePath);
            return await (0, workspaceUtils_1.readFileContent)(fileUri);
        }
        catch (error) {
            console.warn(`Context file not found or could not be read: ${relativePath}. It will be treated as empty.`);
            return '';
        }
    }
    /**
     * 章の本文生成に必要なすべてのコンテキストを構築する
     */
    async buildContextForChapterGeneration() {
        const [characters, world, rules, timeline, arc_map, recent_summaries, open_foreshadows] = await Promise.all([
            this.getCharacters(),
            this.getWorldInfo(),
            this.getStyleRules(),
            this.getTimeline(),
            this.getArcMap(),
            this.getRecentSummaries(2), // 仕様書に基づき直近2章
            this.getOpenForeshadows()
        ]);
        return { characters, world, rules, timeline, arc_map, recent_summaries, open_foreshadows };
    }
    // --- 個別のコンテキスト取得メソッド ---
    async getCharacters() {
        return this.getFileContent(path.join(this.config.paths.bible, 'characters.md'));
    }
    async getWorldInfo() {
        return this.getFileContent(path.join(this.config.paths.bible, 'world.md'));
    }
    async getStyleRules() {
        return this.getFileContent(path.join(this.config.paths.bible, 'rules.md'));
    }
    async getTimeline() {
        return this.getFileContent(path.join(this.config.paths.outline, 'timeline.md'));
    }
    async getArcMap() {
        return this.getFileContent(path.join(this.config.paths.outline, 'arc_map.md'));
    }
    async getRecentSummaries(count) {
        try {
            const root = await this.ensureProjectRoot();
            const summariesDir = vscode.Uri.joinPath(root, this.config.paths.summaries);
            const allFiles = await vscode.workspace.fs.readDirectory(summariesDir);
            const sortedMdFiles = allFiles
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
                .map(([name, _]) => name)
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
            const recentFiles = sortedMdFiles.slice(-count);
            if (recentFiles.length === 0)
                return "（まだ要約はありません）";
            const summariesContent = await Promise.all(recentFiles.map(fileName => this.getFileContent(path.join(this.config.paths.summaries, fileName))));
            return summariesContent.join('\n\n---\n\n');
        }
        catch (error) {
            // summariesディレクトリ自体がない場合など
            console.warn('Could not read summaries directory:', error);
            return "（要約の読み込みに失敗しました）";
        }
    }
    async getForeshadowsTsv() {
        return this.getFileContent(path.join(this.config.paths.bible, 'foreshadows.tsv'));
    }
    async getOpenForeshadows() {
        const tsvContent = await this.getForeshadowsTsv(); // 内部で新しいメソッドを呼ぶ
        if (!tsvContent)
            return "（伏線リストがありません）";
        const lines = tsvContent.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length <= 1)
            return "（未解決の伏線はありません）";
        const header = lines[0].split('\t');
        const statusIndex = header.indexOf('status');
        if (statusIndex === -1) {
            console.warn('Foreshadows TSV is missing "status" column.');
            return tsvContent;
        }
        const openForeshadows = lines.slice(1).filter(line => {
            const columns = line.split('\t');
            return columns.length > statusIndex && columns[statusIndex].trim() === 'open';
        });
        if (openForeshadows.length === 0)
            return "（未解決の伏線はありません）";
        return [lines[0], ...openForeshadows].join('\n');
    }
    /**
     * 指定された種類のプロンプトテンプレートの内容を取得する
     * @param templateName テンプレートの種類
     */
    async getPromptTemplate(templateName) {
        const fileName = `${templateName}.md`;
        return this.getFileContent(path.join(this.config.paths.prompts, fileName));
    }
}
exports.ContextExtractor = ContextExtractor;
//# sourceMappingURL=ContextExtractor.js.map