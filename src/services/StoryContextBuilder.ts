// src/services/StoryContextBuilder.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { getProjectRoot, readFileContent } from '../utils/workspaceUtils';

export class StoryContextBuilder {
    private projectRoot: vscode.Uri | null = null;
    
    constructor() {}

    private async ensureProjectRoot(): Promise<vscode.Uri> {
        if (!this.projectRoot) {
            this.projectRoot = await getProjectRoot();
        }
        return this.projectRoot;
    }

    /**
     * プロジェクトルートからの相対パスでファイル内容を安全に取得するヘルパー
     * ファイルが存在しない場合は空文字列を返す
     * @param relativePath プロジェクトルートからの相対パス
     */
    private async getFileContentSafe(relativePath: string): Promise<string> {
        try {
            const root = await this.ensureProjectRoot();
            const fileUri = vscode.Uri.joinPath(root, relativePath);
            return await readFileContent(fileUri);
        } catch (error) {
            console.warn(`Scenario file not found or could not be read: ${relativePath}. It will be treated as empty.`);
            return '';
        }
    }

    /**
     * キャラクター設定ファイルをすべて読み込み、結合する
     */
    private async getAllCharactersContent(): Promise<string> {
        try {
            const root = await this.ensureProjectRoot();
            const charactersDirUri = vscode.Uri.joinPath(root, 'scenario', 'characters');
            const allFiles = await vscode.workspace.fs.readDirectory(charactersDirUri);
            
            const characterFiles = allFiles
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
                .map(([name, _]) => name);

            if (characterFiles.length === 0) return "（キャラクター設定ファイルが見つかりません）";

            const contents = await Promise.all(
                characterFiles.map(fileName => this.getFileContentSafe(path.join('scenario', 'characters', fileName)))
            );

            return contents.join('\n\n---\n\n');
        } catch (error) {
            console.warn('Could not read characters directory:', error);
            return "（キャラクター設定の読み込みに失敗しました）";
        }
    }

    /**
     * ゲーム開始時にLLMに渡すシステムプロンプトを構築する
     * @returns {Promise<string>} 結合されたシステムプロンプト文字列
     */
    public async buildInitialSystemPrompt(): Promise<string> {
        const [
            worldSetting,
            playerCharacter,
            aiRules,
            characters
        ] = await Promise.all([
            this.getFileContentSafe('scenario/00_world_setting.md'),
            this.getFileContentSafe('scenario/01_player_character.md'),
            this.getFileContentSafe('scenario/02_ai_rules.md'),
            this.getAllCharactersContent()
        ]);

        // 各セクションを結合して最終的なプロンプトを作成
        const systemPrompt = `
# システム指示
あなたはこれから、対話型ストーリーゲームの登場人物（NPC）として振る舞います。以下の設定を厳密に守り、プレイヤーとの対話を通じて物語を進行させてください。

---

## 世界観・舞台設定
${worldSetting || '（設定なし）'}

---

## 主人公（プレイヤー）の情報
${playerCharacter || '（設定なし）'}

---

## 登場人物（NPC）の情報
${characters || '（設定なし）'}

---

## あなた（AI）の行動指針
${aiRules || '（設定なし）'}
`.trim();

        return systemPrompt;
    }

    /**
     * ゲーム開始時の最初のメッセージ（オープニング）を取得する
     * @returns {Promise<string>} オープニングメッセージ
     */
    public async getOpeningScene(): Promise<string> {
        const opening = await this.getFileContentSafe('scenario/03_opening_scene.md');
        return opening || 'こんにちは。ゲームを開始します。';
    }
}