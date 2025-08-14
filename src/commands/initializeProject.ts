// src/commands/initializeProject.ts

import * as vscode from 'vscode';
import * as path from 'path';

// --- ファイルテンプレート ---

const STORYGAMESETTING_JSON_CONTENT = `{
  "$schema": "https://example.com/storygamesetting.schema.json",
  "llmProvider": "openrouter",
  "llmModel": "anthropic/claude-3.5-sonnet",
  "sessionLogs": {
    "enabled": true,
    "directory": "logs"
  }
}
`;

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
# ここに書かれた指示をAIは最優先で守ろうとします。

あなたは今から、シナリオに登場するキャラクターの一人として振る舞ってください。ゲームマスターの視点やナレーションは一切行わずキャラクターのセリフ以外は、心理描写や場面描写は、必ず主人公(プレイヤー)の視点で第三者的に行ってください。あなたは純粋に主人公(プレイヤー)に話しかける登場人物としてのみ行動してください。

## 振る舞いのルール
- 部下としての自然なやり取りを意識してください。
- プレイヤーの反応や行動を受けて、自然な流れで次の会話やイベントを提案してください。
- プレイヤーがどんな行動を提案しても、NPCとして驚いたり喜んだり、疑問を投げかけたりして応答してください。
- 心理描写や場面描写は、必ず主人公(プレイヤー)の視点で行ってください。

## 注意点
- 主人公であるプレイヤーは魅力に溢れています。
- 登場人物は全員美少女です。
- 会話は常に日本語で行い、選択肢形式ではなく対話形式で進めてください。
`;

const OPENING_SCENE_MD_CONTENT = `# ゲーム開始時の状況
# プレイヤーがゲームを開始したときに、最初に表示されるメッセージです。
# ここから物語が始まります。

配属初日、「警視庁特別女子捜査局」の扉を開けると、一人の女性が待っていた。彼女は秘書官クリス・アンダーだ。

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
以下のルールに従って、これまでの「物語の要約」に、新しい「会話ログ」の内容を追記・統合し、更新された要約を作成してください。

## ルール
- 箇条書き形式で、物語の重要な出来事、キャラクターの行動、心情の変化、新しい発見などを簡潔に記述してください。
- 既存の要約の流れを汲み取り、時系列が自然につながるように新しい出来事を追記してください。
- 些細な会話や描写は省略し、物語の根幹に関わる部分だけを抽出してください。
- 要約は常に過去形で記述してください。（例：「〜した。」、「〜と感じた。」）
- 主人公（プレイヤー）の視点から記述してください。

---

## これまでの物語の要約
{{previous_summary}}

---

## 新しい会話ログ
{{new_log}}

---

## 更新された物語の要約
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
            
            // --- ▼▼▼ ここから修正 ▼▼▼ ---
            // logs/archives ディレクトリも追加
            const dirs = [
                'scenario', 
                'scenario/characters', 
                'scenario/prompts',
                'logs', 
                'logs/autosaves',
                'logs/archives', // バックアップ用
                'exports',
                'summaries'
            ];
            // --- ▲▲▲ ここまで修正 ▲▲▲ ---
            for (const dir of dirs) {
                await fs.createDirectory(vscode.Uri.joinPath(projectRoot, dir));
            }

            progress.report({ message: 'Creating scenario files...', increment: 40 });
            
            const filesToCreate: { filePath: string; content: string }[] = [
                { filePath: '.storygamesetting.json', content: STORYGAMESETTING_JSON_CONTENT },
                { filePath: '.gitignore', content: GITIGNORE_CONTENT },
                { filePath: path.join('scenario', '00_world_setting.md'), content: WORLD_SETTING_MD_CONTENT },
                { filePath: path.join('scenario', '01_player_character.md'), content: PLAYER_CHARACTER_MD_CONTENT },
                { filePath: path.join('scenario', '02_ai_rules.md', ), content: AI_RULES_MD_CONTENT },
                { filePath: path.join('scenario', '03_opening_scene.md'), content: OPENING_SCENE_MD_CONTENT },
                { filePath: path.join('scenario', 'characters', 'chris_under.md'), content: CHRIS_UNDER_MD_CONTENT },
                { filePath: path.join('scenario', 'characters', 'naruse_mai.md'), content: NARUSE_MAI_MD_CONTENT },
                { filePath: path.join('scenario', 'prompts', 'summarization_prompt.md'), content: SUMMARIZATION_PROMPT_MD_CONTENT },
            ];
            
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