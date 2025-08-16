
# NovelADV

`NovelADV` (Interactive Novel Game Engine) は **Visual Studio Code 拡張機能**です。その目的は、LLM（大規模言語モデル）をゲームマスター兼NPCとして活用し、ユーザーが対話形式でストーリーゲームをプレイしたり、制作したりすることを支援するツールを提供することです。

主な特徴は以下の通りです。

*   **AIとの対話による物語進行**: チャット形式のUIでAIと対話しながらゲームを進めます。
*   **動的な記憶システム**: 会話が長くなっても文脈を維持するため、長期記憶（自動要約）と短期記憶を組み合わせたシステムを搭載しています。
*   **生きているキャラクター**: 物語の進行に応じてキャラクター設定が自動で更新され、NPCの言動に一貫性と深みを持たせます。
*   **高いカスタマイズ性**: シナリオ設定（世界観、キャラクター、AIへの指示など）はすべてMarkdownファイルで管理され、ユーザーが自由に編集できます。
*   **安全なAPIキー管理**: OSのキーチェーン機能を利用してAPIキーを安全に保管します。

### 2. 機能一覧

ソースコードとドキュメントから、以下の主要機能が特定されました。

| 機能分類 | 機能名 | 概要 | 関連ソース |
| :--- | :--- | :--- | :--- |
| **プロジェクト管理** | ① シナリオプロジェクト初期化 | コマンド一つで、ゲームシナリオに必要なディレクトリ構造と設定テンプレートを自動生成します。 | `src/commands/initializeProject.ts` |
| | ② シナリオのフォーク | 既存のシナリオ設定をコピーして、新しい物語の分岐（IFルート）を簡単に作成します。 | `src/commands/forkProject.ts` |
| **ゲームプレイ** | ③ AIとの対話（チャット） | Webviewで提供されるチャットパネルで、AIが演じるNPCと対話し物語を進めます。 | `src/webview/ChatPanel.ts` `src/providers/OpenRouterProvider.ts` |
| | ④ コンテキスト構築 | 世界観、キャラクター、AIルール、要約（長期記憶）、直近の会話（短期記憶）を結合し、LLMへの指示（システムプロンプト）を動的に生成します。 | `src/services/StoryContextBuilder.ts` `src/services/SessionManager.ts` |
| **記憶システム** | ⑤ 自動要約（長期記憶） | 会話が一定量に達すると、LLMが自動でこれまでの出来事を要約し、長期記憶として保持します。 | `src/services/SessionManager.ts` `src/services/SummarizerService.ts` |
| | ⑥ キャラクター設定の自動更新 | 物語の要約が更新されると、その内容を基に各キャラクターの性格や状況の変化を解釈し、設定ファイルを自動更新します。 | `src/services/CharacterUpdaterService.ts` |
| **セッション管理** | ⑦ セーブ＆ロード | ゲームの進行状況を手動で保存（セーブ）したり、過去のセーブデータを読み込ん（ロード）だりできます。 | `src/services/SessionManager.ts` `src/webview/ChatPanel.ts` |
| | ⑧ 自動保存と自動再開 | 対話は自動で保存され、チャットパネルを開くと最新の状態からゲームを再開できます。 | `src/services/SessionManager.ts` |
| | ⑨ 一手戻す (Undo) | 直前のプレイヤーの発言とAIの応答をセットで取り消すことができます。 | `src/services/SessionManager.ts` |
| **ユーティリティ** | ⑩ ログのエクスポート | 保存されたセッションログを、人間が読みやすいMarkdown形式で出力します。 | `src/commands/exportLogToMarkdown.ts` |
| | ⑪ キャラクターシート自動生成 | 会話ログを分析し、コマンド一つで新しいキャラクターの設定シートを自動生成します。 | `src/services/CharacterGeneratorService.ts` |
| **設定・セキュリティ** | ⑫ 安全なAPIキー管理 | OS標準の認証情報マネージャー（キーチェーン等）を使い、LLMのAPIキーを安全に保存します。 | `src/services/KeytarService.ts` |
| | ⑬ LLM設定のカスタマイズ | VS Codeの設定画面から、対話用と要約用のLLMモデルやパラメータを個別に設定できます。 | `src/services/ConfigService.ts` `package.json` |

---

## 機能仕様書

### 1. システムアーキテクチャ

本拡張機能は、以下の主要コンポーネントで構成されています。

*   **拡張機能本体 (Extension Host)**: VS Codeのバックエンドで動作します。
    *   **Commands**: ユーザーがコマンドパレットから実行する処理 (`initializeProject`, `forkProject`など)。
    *   **Services**: ビジネスロジックの中核。セッション管理、LLMとの通信、ファイル操作などを担当します。
    *   **ChatPanel**: Webviewを管理し、フロントエンドとのデータ送受信を行います。
*   **Webview (Frontend)**: ユーザーが対話するチャットUI。HTML, CSS, JavaScriptで構成されています。
*   **ファイルシステム**: シナリオ設定、ログ、要約などのデータを永続化します。
*   **外部API (LLM Provider)**: OpenRouterなどのLLMプロバイダーと通信し、物語のテキストを生成します。

#### データフロー (チャット送信時)

1.  **ユーザー**: Webview (`media/main.js`) の入力欄にメッセージを入力し、送信ボタンを押す。
2.  **Webview**: メッセージを `ChatPanel.ts` に送信する。
3.  **ChatPanel.ts**: `SessionManager.ts` を呼び出し、ユーザーメッセージを履歴に追加する。
4.  **SessionManager.ts**: `StoryContextBuilder.ts` を使って構築された基本プロンプトに、最新の要約と短期記憶（直近の会話履歴）を追加し、LLMに渡すための完全なメッセージリストを生成する。
5.  **ChatPanel.ts**: `OpenRouterProvider.ts` を呼び出し、メッセージリストをLLMに送信する。
6.  **OpenRouterProvider.ts**: `KeytarService.ts` からAPIキーを取得し、`ConfigService.ts` からLLMの設定を読み込み、外部APIにリクエストを送信する。
7.  **外部API**: ストリーミングで応答を返す。
8.  **OpenRouterProvider.ts**: 受け取った応答チャンクを `ChatPanel.ts` にコールバックで通知する。
9.  **ChatPanel.ts**: 応答チャンクをWebviewに送信し、UIをリアルタイムで更新する。
10. **処理完了後**: `SessionManager.ts` はAIの完全な応答を履歴に追加し、セッションを自動保存する。
11. **(要約トリガー)**: `SessionManager.ts` は会話の量がしきい値を超えたか判定し、超えていればバックグラウンドで `SummarizerService.ts` と `CharacterUpdaterService.ts` を呼び出して記憶の更新処理を開始する。

### 2. 機能仕様詳細

#### 2.1 プロジェクト管理機能

##### 2.1.1 シナリオプロジェクトの初期化 (F-001)

*   **概要**: 新しい対話型ストーリーゲームのシナリオプロジェクトを作成するために必要なディレクトリ構造と設定テンプレートファイルを一括で生成する。
*   **トリガー**: コマンドパレットから `Novel_Init: Initialize New Scenario Project` を実行。
*   **処理フロー**:
    1.  ユーザーにプロジェクトを保存する親フォルダを選択させる。
    2.  ユーザーに新しいプロジェクト名を入力させる。
    3.  指定された場所にプロジェクトフォルダを作成し、以下のディレクトリ構造を生成する。
        *   `scenario/characters`
        *   `scenario/prompts`
        *   `logs/autosaves`, `logs/archives`, `logs/transcripts`
        *   `exports`
        *   `summaries`
    4.  各種設定ファイルとテンプレートファイルを生成・配置する。
        *   `.storygamesetting.json`: プロジェクト固有の設定ファイル。
        *   `.gitignore`: Git管理用の無視ファイルリスト。
        *   `scenario/*.md`: 世界観、プレイヤー、AIルール、オープニングのテンプレート。
        *   `scenario/characters/*.md`: デフォルトのキャラクター設定テンプレート。
        *   `scenario/prompts/*.md`: 要約、キャラクター更新/生成用のプロンプトテンプレート。
        *   `summaries/latest_summary.json`: 初期状態の要約ファイル。
    5.  処理完了後、生成されたプロジェクトフォルダを新しいVS Codeウィンドウで開くかユーザーに尋ねる。
*   **関連コンポーネント**: `src/commands/initializeProject.ts`

##### 2.1.2 シナリオのフォーク (F-002)

*   **概要**: 現在開いているプロジェクトのシナリオ設定 (`scenario` フォルダ) を引き継いで、新しいプロジェクトを作成する。物語のIFルートを作成する際に使用する。
*   **トリガー**: コマンドパレットから `Novel_Fork: Fork Scenario from Current Project` を実行。
*   **事前条件**: 有効なシナリオプロジェクトが開かれていること。
*   **処理フロー**:
    1.  `F-001` と同様に、新しいプロジェクトの保存場所と名前をユーザーに尋ねる。
    2.  `F-001` と同様のディレクトリ構造とデフォルトファイルを生成する。
    3.  **元のプロジェクトから `scenario` ディレクトリ全体を、新しく作成したプロジェクトに再帰的にコピーする。**
    4.  処理完了後、フォークしたプロジェクトを開くかユーザーに尋ねる。
*   **関連コンポーネント**: `src/commands/forkProject.ts`

#### 2.2 ゲームプレイ機能

##### 2.2.1 AIとの対話 (F-003)

*   **概要**: Webviewで表示されるチャットパネルを通じて、ユーザーがテキストを入力し、LLMからの応答を受け取ることで物語を進行させる。
*   **トリガー**:
    *   コマンドパレットから `Novel_Start: Open Chat` を実行。
    *   Webview内の送信ボタンをクリック、または `Ctrl+Enter` ( `Cmd+Enter` ) を押下。
*   **UI仕様**:
    *   **チャットログ**: ユーザーとAIの発言が交互に表示される。
    *   **入力エリア**: ユーザーがテキストを入力するテキストエリア。
    *   **ボタン**: `送信`, `セーブ`, `ロード`, `Undo` ボタン。
    *   **思考中インジケーター**: AIが応答を生成中は「Thinking...」アニメーションが表示される。
    *   **ストリーミング表示**: AIの応答は生成され次第、リアルタイムで画面に表示される。
*   **関連コンポーネント**: `src/webview/ChatPanel.ts`, `media/main.js`, `media/main.css`

##### 2.2.2 コンテキスト構築 (F-004)

*   **概要**: LLMが物語の一貫性を保ち、設定に沿った応答を生成するために、必要な情報をすべて結合してシステムプロンプトとして提供する。
*   **処理フロー**:
    1.  **基本プロンプトの構築 (`StoryContextBuilder.ts`)**:
        *   `scenario/00_world_setting.md` (世界観)
        *   `scenario/01_player_character.md` (主人公設定)
        *   `scenario/characters/` 以下の全キャラクター設定ファイル
        *   `scenario/02_ai_rules.md` (AIへの行動指針)
        *   上記を結合し、基本的なシステムプロンプトを生成する。
    2.  **動的情報の追加 (`SessionManager.ts`)**:
        *   `summaries/latest_summary.json` の内容 (長期記憶) を基本プロンプトに追加する。
        *   直近の会話履歴 (短期記憶) をメッセージリストに追加する。
    3.  最終的に整形されたメッセージリストがLLMに送信される。
*   **関連コンポーネント**: `src/services/StoryContextBuilder.ts`, `src/services/SessionManager.ts`

#### 2.3 記憶システム

##### 2.3.1 自動要約 (F-005)

*   **概要**: 会話が長くなった際に、過去の会話ログをLLMに要約させ、それを「長期記憶」として保持する。これにより、LLMのコンテキストウィンドウの制限を回避し、物語の全体像を維持する。
*   **トリガー**: セッション内のメッセージ数が `.storygamesetting.json` で定義された `summarizationTriggerMessages` に達した時。
*   **処理フロー**:
    1.  `SessionManager` がトリガーを検知し、要約処理を開始する。
    2.  短期記憶として残す分を除いた、古い会話ログを抽出する。
    3.  `SummarizerService` が、既存の要約と新しい会話ログを `summarization_prompt.md` のテンプレートに埋め込み、LLMに要約の更新を依頼する。
    4.  LLMから返された新しい要約で、セッション内の長期記憶を更新する。
    5.  更新された要約を `summaries/latest_summary.json` に保存する。
    6.  セッション内の会話履歴から、要約済みの古いログを削除し、短期記憶分のみを残す。
*   **関連コンポーネント**: `src/services/SessionManager.ts`, `src/services/SummarizerService.ts`

##### 2.3.2 キャラクター設定の自動更新 (F-006)

*   **概要**: 物語の進行（要約の更新）を反映させるため、キャラクター設定ファイルの内容をLLMが自動で更新する。
*   **トリガー**: `F-005` の自動要約処理が正常に完了した後。
*   **処理フロー**:
    1.  `SessionManager` が `CharacterUpdaterService` を呼び出す。
    2.  `CharacterUpdaterService` は `scenario/characters/` ディレクトリ内のすべてのキャラクターファイルを対象とする。
    3.  各キャラクターファイルについて、以下の処理を並行して実行する。
        *   既存のキャラクター設定と新しい物語の要約を `character_update_prompt.md` のテンプレートに埋め込む。
        *   LLMに設定の更新を依頼する。
        *   LLMから返された内容で、元のキャラクターファイルを上書き保存する。
*   **関連コンポーネント**: `src/services/SessionManager.ts`, `src/services/CharacterUpdaterService.ts`

### 3. データ仕様

#### 3.1 プロジェクトファイル構造

```
MyStoryGame/
├── .storygamesetting.json  # プロジェクト固有の設定 (短期記憶の量など)
├── .gitignore              # Git管理対象外ファイルの設定
├── scenario/               # ゲームのシナリオ設定
│   ├── 00_world_setting.md     # 世界観・舞台設定
│   ├── 01_player_character.md  # 主人公（プレイヤー）設定
│   ├── 02_ai_rules.md          # AIへの行動指針
│   ├── 03_opening_scene.md     # ゲーム開始時のメッセージ
│   ├── characters/             # 登場人物（NPC）の設定ファイル (Markdown形式)
│   └── prompts/                # LLMへの各種システムプロンプト
│       ├── character_generation_prompt.md # キャラクター自動生成用
│       ├── character_update_prompt.md     # キャラクター自動更新用
│       ├── log_digest_prompt.md           # 長文ログの要約用
│       └── summarization_prompt.md        # 自動要約用
├── logs/                   # ゲームのセッションログ
│   ├── archives/               # 手動セーブやバックアップログ (JSON)
│   ├── autosaves/              # 自動保存ログ (JSON)
│   └── transcripts/            # 人間が読みやすい形式の全会話記録 (Markdown)
├── summaries/              # 自動生成された物語の要約
│   └── latest_summary.json     # 最新の長期記憶データ
└── exports/                # Markdown形式でエクスポートされたログ
```

#### 3.2 データモデル

*   **SessionData (`session_*.json`)**:
    *   `systemPrompt`: LLMに渡される基本設定。
    *   `history`: `ChatMessage` の配列。短期記憶として保持される会話履歴。
    *   `summary`: LLMによって生成された物語の要約（長期記憶）。

*   **ChatMessage**:
    *   `role`: `'system'`, `'user'`, `'assistant'` のいずれか。
    *   `content`: メッセージの本文。

*   **VS Code Settings (`settings.json`)**:
    *   `interactive-story.chat.*`: 対話生成用のLLM設定。
    *   `interactive-story.summarization.*`: 要約やキャラクター更新用のLLM設定。
    *   それぞれに `provider`, `model`, `endpoint`, `temperature`, `maxTokens`, `providerOptions` を設定可能。

### 4. (参考) 廃止または未使用の機能

`old/` ディレクトリには、現在のメインロジックからは呼び出されていないファイル群が存在します。これらは過去のバージョンで使われていたか、将来的に実装が検討されている機能の残骸である可能性があります。

*   **`checkConsistency.ts`**: 章の本文と設定資料の矛盾をチェックする機能。
*   **`createChapterFromTemplate.ts`**: 章ごとのドラフトファイルを対話形式で生成する機能。
*   **`updateForeshadows.ts`**: TSV形式で管理された伏線リストを、章の内容に応じて更新する機能。

これらの機能は現在の`package.json`にコマンドとして登録されておらず、`extension.ts`からも呼び出されていないため、**現在のバージョンでは利用できません**。