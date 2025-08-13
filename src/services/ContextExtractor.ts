// src/services/ContextExtractor.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigService } from './ConfigService';
import { getNovelProjectRoot, readFileContent } from '../utils/workspaceUtils';
import { NovelAssistantConfig } from '../types';

/**
 * 本文生成時にプロンプトへ注入するコンテキストのデータ構造
 */
export interface GenerationContext {
    characters: string;
    world: string;
    rules: string;
    timeline: string;
    arc_map: string;
    recent_summaries: string;
    open_foreshadows: string;
}

export type PromptTemplateType = 'generation' | 'summarization' | 'foreshadow_update' | 'consistency_check';

export class ContextExtractor {
    private config: NovelAssistantConfig;
    private projectRoot: vscode.Uri | null = null;

    constructor() {
        this.config = ConfigService.getInstance().get();
    }

    /**
     * プロジェクトルートURIをキャッシュしつつ取得する
     */
    private async ensureProjectRoot(): Promise<vscode.Uri> {
        if (!this.projectRoot) {
            this.projectRoot = await getNovelProjectRoot();
        }
        return this.projectRoot;
    }

    /**
     * プロジェクトルートからの相対パスでファイル内容を取得するヘルパー
     * @param relativePath プロジェクトルートからの相対パス
     */
    private async getFileContent(relativePath: string): Promise<string> {
        try {
            const root = await this.ensureProjectRoot();
            const fileUri = vscode.Uri.joinPath(root, relativePath);
            return await readFileContent(fileUri);
        } catch (error) {
            console.warn(`Context file not found or could not be read: ${relativePath}. It will be treated as empty.`);
            return '';
        }
    }

    /**
     * 章の本文生成に必要なすべてのコンテキストを構築する
     */
    public async buildContextForChapterGeneration(): Promise<GenerationContext> {
        const [
            characters,
            world,
            rules,
            timeline,
            arc_map,
            recent_summaries,
            open_foreshadows
        ] = await Promise.all([
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

    public async getCharacters(): Promise<string> {
        return this.getFileContent(path.join(this.config.paths.bible, 'characters.md'));
    }

    public async getWorldInfo(): Promise<string> {
        return this.getFileContent(path.join(this.config.paths.bible, 'world.md'));
    }

    public async getStyleRules(): Promise<string> {
        return this.getFileContent(path.join(this.config.paths.bible, 'rules.md'));
    }
    
    public async getTimeline(): Promise<string> {
        return this.getFileContent(path.join(this.config.paths.outline, 'timeline.md'));
    }

    public async getArcMap(): Promise<string> {
        return this.getFileContent(path.join(this.config.paths.outline, 'arc_map.md'));
    }

    public async getRecentSummaries(count: number): Promise<string> {
        try {
            const root = await this.ensureProjectRoot();
            const summariesDir = vscode.Uri.joinPath(root, this.config.paths.summaries);
            
            const allFiles = await vscode.workspace.fs.readDirectory(summariesDir);
            
            const sortedMdFiles = allFiles
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
                .map(([name, _]) => name)
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

            const recentFiles = sortedMdFiles.slice(-count);

            if (recentFiles.length === 0) return "（まだ要約はありません）";
            
            const summariesContent = await Promise.all(
                recentFiles.map(fileName => this.getFileContent(path.join(this.config.paths.summaries, fileName)))
            );

            return summariesContent.join('\n\n---\n\n');
        } catch (error) {
            // summariesディレクトリ自体がない場合など
            console.warn('Could not read summaries directory:', error);
            return "（要約の読み込みに失敗しました）";
        }
    }

        public async getForeshadowsTsv(): Promise<string> {
        return this.getFileContent(path.join(this.config.paths.bible, 'foreshadows.tsv'));
    }

    public async getOpenForeshadows(): Promise<string> {
        const tsvContent = await this.getForeshadowsTsv(); // 内部で新しいメソッドを呼ぶ
        if (!tsvContent) return "（伏線リストがありません）";

        const lines = tsvContent.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length <= 1) return "（未解決の伏線はありません）";
        
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

        if (openForeshadows.length === 0) return "（未解決の伏線はありません）";

        return [lines[0], ...openForeshadows].join('\n');
    }

    /**
     * 指定された種類のプロンプトテンプレートの内容を取得する
     * @param templateName テンプレートの種類
     */
    public async getPromptTemplate(templateName: PromptTemplateType): Promise<string> {
        const fileName = `${templateName}.md`;
        return this.getFileContent(path.join(this.config.paths.prompts, fileName));
    }
}