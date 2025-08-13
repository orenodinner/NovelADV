// src/commands/initializeProject.ts

import * as vscode from 'vscode';
import * as path from 'path';

// --- ファイルテンプレート ---

const NOVELRC_JSON_CONTENT = `{
  "$schema": "https://example.com/novelrc.schema.json",
  "provider": "openrouter",
  "model": "anthropic/claude-3.5-sonnet",
  "endpoint": "https://openrouter.ai/api/v1/chat/completions",
  "apiKeyStore": "keychain",
  "maxTokens": 3000,
  "temperature": 0.7,
  "language": "ja-JP",
  "providerOptions": {
    "openrouter": {
      "httpReferer": "",
      "xTitle": "Novel Assistant for VS Code",
      "extraHeaders": {}
    }
  },
  "output": {
    "chapterLengthChars": [3000, 7000],
    "summarySentences": 5
  },
  "paths": {
    "bible": "bible",
    "outline": "outline",
    "chapters": "chapters",
    "summaries": "summaries",
    "reports": "reports",
    "prompts": "prompts"
  },
  "consistency": {
    "checks": ["voice", "world_rules", "timeline", "names_terms"],
    "strictness": "medium"
  },
  "rateLimit": { "rpm": 30, "burst": 5 },
  "telemetry": { "enabled": false }
}
`;

const CHARACTERS_MD_CONTENT = `# 登場人物

## 久遠 茜 (くどう あかね)
- **口調**: 簡潔・冷静。感情の起伏は少ないが、核心を突く発言が多い。
- **役割**: 主人公のパートナー。探偵役。
- **関係**: 朝霧透とは旧知の仲。

## 朝霧 透 (あさぎり とおる)
- **口調**: 軽口を叩くことが多いが、観察眼は鋭い。
- **役割**: 主人公。物語の語り手。
- **関係**: 久遠茜に振り回されがち。
`;

const FORESHADOWS_TSV_CONTENT = `id\ttype\tstatus\tintroduced_in\tresolved_in\tdescription\tnotes`;

const GENERATION_PROMPT_CONTENT = `あなたはプロの小説家です。以下の制約と設定に基づき、物語の続きを生成してください。

【固定スタイル】
- 三人称／地の文厚め／会話は簡潔
- 禁止：設定矛盾、過剰な新規固有名詞、無断の一人称変更
- 口調サンプル：久遠茜=簡潔・冷静／朝霧透=軽口で観察眼

【必要設定（抜粋）】
<登場人物>
{{characters}}
</登場人物>

<世界観ルール>
{{world}}
</世界観ルール>

【これまでの要約（直近2章）】
{{summaries}}

【今回の章の目的・見せ場】
{{arc_map}}

【出力】
1) 章本文（3500-6000字）
2) 章の要約（5文）
3) 新規に張った伏線（ID候補・説明）
4) 消化した伏線（ID・根拠となる本文引用）
5) 整合性セルフチェック（懸念点/対処）
`;

// 他のプロンプトやファイルのテンプレートも同様に定義
const SUMMARIZATION_PROMPT_CONTENT = `# 指示
以下の小説本文から、重要な要素を抽出してください。

# 出力形式
- 5文程度の要約
- 登場した固有名詞リスト（人、組織、地名、専門用語）
- この章の目的（1行で）

# 本文
{{chapter_content}}
`;

const FORESHADOW_UPDATE_PROMPT_CONTENT = `# 指示
以下の「現在の伏線リスト(TSV)」と「新しい章の本文」を読み、伏線リストを更新するための差分情報をTSV形式で出力してください。

# 判断基準
- 新規伏線: 本文中で新たに提示された謎や未解決の事柄。
- 回収済み伏線: 既存の伏線が本文中で解決または大きく進展した場合。statusを 'resolved' に変更し、resolved_in に現在の章IDを記入。
- 変化なし: そのままにする。

# 現在の伏線リスト(TSV)
{{foreshadows_tsv}}

# 新しい章の本文
{{chapter_content}}

# 出力 (差分のみTSV形式)
`;

const CONSISTENCY_CHECK_PROMPT_CONTENT = `# 指示
あなたは編集者です。以下の小説本文と設定資料を読み、設定の矛盾点や改善点を指摘してください。

# チェック項目
- 口調の逸脱: キャラクターの口調が設定から外れていないか。
- 世界観の矛盾: 魔法や技術のルールが守られているか。
- 時系列の矛盾: タイムラインと出来事の順序が合っているか。
- 用語の揺れ: 固有名詞や専門用語の表記が統一されているか。

# 出力形式
矛盾点や懸念事項を、以下の形式でリストアップしてください。
- **重大度**: high / medium / low
- **箇所**: 矛盾がある本文の引用
- **問題点**: なぜ問題なのかの説明
- **修正提案**: どのように修正すべきかの提案

# 設定資料
{{bible_content}}

# 小説本文
{{chapter_content}}
`;

// --- 初期化処理 ---

export async function initializeProject() {
    const folderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select Project Parent Folder'
    });

    if (!folderUri || folderUri.length === 0) {
        vscode.window.showInformationMessage('Project initialization cancelled.');
        return;
    }

    const parentFolder = folderUri[0];
    const projectName = await vscode.window.showInputBox({
        prompt: 'Enter your story project name',
        value: 'MyStory'
    });

    if (!projectName) {
        vscode.window.showInformationMessage('Project initialization cancelled.');
        return;
    }

    const projectRoot = vscode.Uri.joinPath(parentFolder, projectName);
    const fs = vscode.workspace.fs;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Initializing story project: ${projectName}`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: 'Creating directories...', increment: 10 });
            
            const dirs = ['bible', 'outline', 'chapters', 'summaries', 'reports', 'prompts', 'logs'];
            for (const dir of dirs) {
                await fs.createDirectory(vscode.Uri.joinPath(projectRoot, dir));
            }

            progress.report({ message: 'Creating files...', increment: 40 });

            const filesToCreate: { filePath: string; content: string }[] = [
                { filePath: '.novelrc.json', content: NOVELRC_JSON_CONTENT },
                { filePath: path.join('bible', 'characters.md'), content: CHARACTERS_MD_CONTENT },
                { filePath: path.join('bible', 'world.md'), content: '# 世界観\n\n- この世界の魔法は...' },
                { filePath: path.join('bible', 'rules.md'), content: '# 文体・作風ルール\n\n- ...' },
                { filePath: path.join('bible', 'foreshadows.tsv'), content: FORESHADOWS_TSV_CONTENT },
                { filePath: path.join('outline', 'timeline.md'), content: '# 時系列\n\n- 4/10: ...' },
                { filePath: path.join('outline', 'arc_map.md'), content: '# 章のプロット\n\n- 第1章: ...' },
                { filePath: path.join('prompts', 'generation.md'), content: GENERATION_PROMPT_CONTENT },
                { filePath: path.join('prompts', 'summarization.md'), content: SUMMARIZATION_PROMPT_CONTENT },
                { filePath: path.join('prompts', 'foreshadow_update.md'), content: FORESHADOW_UPDATE_PROMPT_CONTENT },
                { filePath: path.join('prompts', 'consistency_check.md'), content: CONSISTENCY_CHECK_PROMPT_CONTENT },
            ];
            
            const encoder = new TextEncoder();
            for (const file of filesToCreate) {
                const uri = vscode.Uri.joinPath(projectRoot, file.filePath);
                await fs.writeFile(uri, encoder.encode(file.content));
            }
            
            progress.report({ message: 'Finishing up...', increment: 50 });

            const openFolder = await vscode.window.showInformationMessage(
                `Project '${projectName}' created successfully!`,
                'Open Folder'
            );
            if (openFolder === 'Open Folder') {
                await vscode.commands.executeCommand('vscode.openFolder', projectRoot, { forceNewWindow: true });
            }

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to initialize project: ${error.message}`);
            console.error(error);
        }
    });
}