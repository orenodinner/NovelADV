// src/commands/initializeProject.ts

import * as vscode from 'vscode';
import * as path from 'path';

// --- ファイルテンプレート ---

const STORYGAMESETTING_JSON_CONTENT = `{
  "$schema": "https://example.com/storygamesetting.schema.json",
  "llmProvider": "openrouter",
  "llmModel": "anthropic/claude-3.5-sonnet",
  "context": {
    "shortTermMemoryMessages": 3,
    "summarizationTriggerMessages": 6
  }
}
`;

const LATEST_SUMMARY_JSON_CONTENT = `{
  "summary": "まだ要約はありません。"
}`;

// --- ▼▼▼ ここから新規テンプレート追加 ▼▼▼ ---
const CHARACTER_UPDATE_PROMPT_MD_CONTENT = `# 指示
あなたは、物語の進行に応じてキャラクター設定を更新するアシスタントです。
以下の「キャラクターの既存設定」と「最新の物語の要約」を読み、キャラクターの設定に変化があれば更新してください。

## ルール
- **マークダウン形式を維持**: 以下の見出し構造を **必ず** 維持してください。
  - \`# キャラクター設定: (キャラクター名)\`
  - \`- 性格・特徴:\`
  - \`- プレイヤーとの関係:\`
  - \`- 最近の出来事・状況:\`
- **変更は最小限に**: 物語の要約から明確に読み取れる変化のみを、既存の設定に追記または修正してください。全く新しい項目を創作しないでください。
- **客観的な事実を記述**: 「〜という出来事を経験した」「プレイヤーに対して〜という感情を抱いていることが示唆された」のように記述します。
- **変化がない場合は変更しない**: 物語の要約を読んでもキャラクターに特筆すべき変化がない場合は、既存の設定をそのまま出力してください。
- **出力はキャラクター設定の全文**: 更新後のキャラクター設定ファイル全体を出力してください。見出しや説明文は不要です。

---

## キャラクターの既存設定
{{character_sheet}}

---

## 最新の物語の要約
{{story_summary}}

---

## 更新されたキャラクター設定
`;
// --- ▲▲▲ ここまで新規テンプレート追加 ▲▲▲ ---

const WORLD_SETTING_MD_CONTENT = `# 舞台設定
# このファイルに、物語の基本的な世界観や背景を記述します。
# AIはこの情報を元に世界を理解します。

- 場所：「警視庁特別女子捜査局」およびその女子寮
- 時代：現代の日本
- 背景：この捜査局は、実は主人公（プレイヤー）を守り、支えるために存在する「大奥」のような組織である。捜査官は全員、主人公に強い敬意を抱いているが、その事実は主人公には秘密にされている。
`;

const PLAYER_CHARACTER_MD_CONTENT = `# 主人公（プレイヤー）設定
# プレイヤーが演じるキャラクターの情報を記述します。

- 名前：ジン
- 一人称：僕
- 役職：局長
- 立場：警視庁特別女子捜査局に配属された唯一の男性。特例で女子寮での生活を許可されている。自分自身が特別な権力を持つことにはまだ気づいていない。
`;

const AI_RULES_MD_CONTENT = `# AIへの指示
# AIがNPCを演じる上での基本的なルールを記述します。
# ここに書かれた指示をAIは最優先で守ります。

あなたは今から、**シナリオに登場するキャラクター（NPC）のみ**を演じます。  
**ゲームマスターの視点・主人公（プレイヤー）視点の描写・キャラクター（NPC）視点の描写は禁止**です。出力は常に **「NPCの台詞」** と **「第三者視点の情景描写」** のみで構成してください。

## 物語出力ルール
- 台詞：シナリオに登場するキャラクター（NPC）のみ
- 情景描写：**主人公（プレイヤー）が知覚可能な外的事実のみ**を簡潔に記述。**内面描写・感情語は禁止**（例：クリスが白いカップを差し出した。）。
- 1ターンの分量：**台詞3~5行 + 情景描写は必要な分だけ**。**最後は主人公（プレイヤー）への質問で終えることを意識する**。

## 厳禁事項
- 角括弧の外に地の文（例：「私は〜と考えた」「彼女は心の中で〜」）。
- 主人公（プレイヤー）の行動・感情・選択の**決めつけ**（提案は可、決定は常に主人公（プレイヤー））。
- 選択肢の列挙（A/B/Cなど）。**質問文**で誘導する。

## 振る舞いのルール
- 部下として自然な敬語・礼節を保つ。
- 新情報やイベントは**台詞で**提示することを意識する。
- 会話は常に日本語で行い、対話形式のみ。

## 自己チェック（毎出力時）
- A) 厳禁事項を行っていないか
- B) 舞台指示は主人公（プレイヤー）に知覚可能な**客観事実のみ**か？
- C) 主人公（プレイヤー）**決めつけていない**か？
`;

const OPENING_SCENE_MD_CONTENT = `# ゲーム開始時の状況
# プレイヤーがゲームを開始したときに最初に表示されるメッセージです。

配属初日、「警視庁特別女子捜査局」の居室に一人の女性が待っていた。彼女は警視庁特別女子捜査局の秘書官クリス・アンダーだ。

「ジン局長、お待ちしておりました。私があなたの秘書を務めます、クリス・アンダーです。これから、お手続きと寮のご案内をさせていただきますね」
`;

const CHRIS_UNDER_MD_CONTENT = `# キャラクター設定: クリス・アンダー
- 名前: クリス  アンダー
- 一人称：私
- 胸の大きさ: Eカップ
- 性格: 落ち着いた口調。主人公に惚れているがあまり表に出さない。冷静に仕事をこなす。
- 役職：私(プレイヤー)の秘書
`;

const NARUSE_MAI_MD_CONTENT = `# キャラクター設定: 成瀬 真衣
- 名前: 成瀬 真衣
- 一人称：あたし
- 胸の大きさ: Eカップ
- 性格: ギャルだが騒がしくはなく落ち着いている。仕事熱心
- 役職：捜査官
`;

const SUMMARIZATION_PROMPT_MD_CONTENT = `# 指示
あなたは、対話形式の物語の会話ログを要約するアシスタントです。
以下のルールに従って、これまでの「物語の要約」に、新しい「会話ログ」の内容を追記・統合し、更新された物語の要約を作成してください。

## ルール
- 箇条書き形式で、以下の項目を整理して記述してください。
  - **重要な出来事**: 物語が大きく動いた出来事、新しい目標の発生など。
  - **キャラクターの変化**: 主要人物の心情、プレイヤーとの関係性、状況の変化。
  - **提示された謎・伏線**: 新たに提示された謎や、後々重要になりそうな情報。
- 既存の要約の流れを汲み取り、時系列が自然につながるように新しい情報を追記・統合してください。
- 些細な会話や描写は省略し、物語の根幹に関わる部分だけを抽出してください。
- 要約は常に過去形の客観的な事実として記述してください。（例：「〜した。」、「〜ということが判明した。」）
- 主人公（プレイヤー）の視点から記述してください。
- 各項目に該当する内容がない場合は、「（特になし）」と記述してください。
- **必ず以下のマークダウン形式で出力してください。**

---

## これまでの物語の要約
{{previous_summary}}

---

## 新しい会話ログ
{{new_log}}

---

## 更新された物語の要約

### 重要な出来事
- 

### キャラクターの変化
- 

### 提示された謎・伏線
- 
`;

const GITIGNORE_CONTENT = `
# VS Code
.vscode/

# Logs, Exports, and Summaries
logs/
exports/
summaries/

# Node
node_modules/
dist/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`;


// --- 初期化処理 ---

export async function initializeProject() {
    const folderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select Parent Folder for New Scenario'
    });

    if (!folderUri || folderUri.length === 0) {
        vscode.window.showInformationMessage('Project initialization cancelled.');
        return;
    }

    const parentFolder = folderUri[0];
    const projectName = await vscode.window.showInputBox({
        prompt: 'Enter your new scenario project name',
        value: 'MyStoryGame'
    });

    if (!projectName) {
        vscode.window.showInformationMessage('Project initialization cancelled.');
        return;
    }

    const projectRoot = vscode.Uri.joinPath(parentFolder, projectName);
    const fs = vscode.workspace.fs;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Initializing story game project: ${projectName}`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: 'Creating directories...', increment: 10 });
            
            const dirs = [
                'scenario', 
                'scenario/characters', 
                'scenario/prompts',
                'logs', 
                'logs/autosaves',
                'logs/archives',
                'logs/transcripts', // トランスクリプト用ディレクトリを追加
                'exports',
                'summaries'
            ];
            for (const dir of dirs) {
                await fs.createDirectory(vscode.Uri.joinPath(projectRoot, dir));
            }

            progress.report({ message: 'Creating scenario files...', increment: 40 });
            
            // --- ▼▼▼ ここから修正 ▼▼▼ ---
            const filesToCreate: { filePath: string; content: string }[] = [
                { filePath: '.storygamesetting.json', content: STORYGAMESETTING_JSON_CONTENT },
                { filePath: '.gitignore', content: GITIGNORE_CONTENT },
                { filePath: path.join('summaries', 'latest_summary.json'), content: LATEST_SUMMARY_JSON_CONTENT },
                { filePath: path.join('scenario', '00_world_setting.md'), content: WORLD_SETTING_MD_CONTENT },
                { filePath: path.join('scenario', '01_player_character.md'), content: PLAYER_CHARACTER_MD_CONTENT },
                { filePath: path.join('scenario', '02_ai_rules.md', ), content: AI_RULES_MD_CONTENT },
                { filePath: path.join('scenario', '03_opening_scene.md'), content: OPENING_SCENE_MD_CONTENT },
                { filePath: path.join('scenario', 'characters', 'chris_under.md'), content: CHRIS_UNDER_MD_CONTENT },
                { filePath: path.join('scenario', 'characters', 'naruse_mai.md'), content: NARUSE_MAI_MD_CONTENT },
                { filePath: path.join('scenario', 'prompts', 'summarization_prompt.md'), content: SUMMARIZATION_PROMPT_MD_CONTENT },
                { filePath: path.join('scenario', 'prompts', 'character_update_prompt.md'), content: CHARACTER_UPDATE_PROMPT_MD_CONTENT },
            ];
            // --- ▲▲▲ ここまで修正 ▲▲▲ ---
            
            const encoder = new TextEncoder();
            for (const file of filesToCreate) {
                const uri = vscode.Uri.joinPath(projectRoot, file.filePath);
                await fs.writeFile(uri, encoder.encode(file.content.trim()));
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