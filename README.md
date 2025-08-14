# まだ開発中

# NovelADV

[![Visual Studio Marketplace](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://marketplace.visualstudio.com/VSCode)

**NovelADV** は、VS Code上で動作する、LLM（大規模言語モデル）を活用した対話型ストーリーゲームのプレイ＆制作支援ツールです。

LLMをゲームマスター兼NPCとして、シナリオに沿った自由な対話を楽しむことができます。また、ゲームの進行に応じてキャラクターの心情や設定が動的に変化し、物語の要約（長期記憶）が自動で生成されるため、長期間のプレイでも文脈を失うことなく一貫した物語体験が可能です。

## ✨ 主な機能

*   **💬 AIとの対話によるゲームプレイ**:
    チャット形式のUIでAI（NPC）と対話しながら、物語をリアルタイムに進めていきます。AIはシナリオ設定（世界観、キャラクター、行動指針など）を深く理解した上で応答します。

*   **🧠 動的な記憶システム**:
    *   **長期記憶（自動要約）**: 会話が一定量進むと、LLMがこれまでの出来事を自動で要約し、長期的な記憶として保持します。これにより、AIは物語の全体像を忘れずに応答できます。
    *   **短期記憶**: 直近の会話は短期記憶として扱われ、LLMへのコンテキストに含められます。

*   **👤 生きているキャラクター**:
    物語の進行（要約の更新）に応じて、LLMが各キャラクターの性格や状況の変化を解釈し、キャラクター設定ファイルを自動で更新します。

*   **🚀 シナリオの簡単セットアップ**:
    `Initialize New Scenario Project`コマンド一つで、ゲームシナリオに必要なディレクトリ構造と設定テンプレートファイルを自動生成します。

*   **🍴 シナリオのフォーク**:
    既存のシナリオ設定を引き継いで、新しい物語の分岐（IFルート）を簡単に作成できます。

*   **💾 セッション管理**:
    ゲームの進行状況は自動で保存されます。また、手動でのセーブ・ロード機能も備えており、好きな時点からゲームを再開できます。

*   **🔐 安全なAPIキー管理**:
    `keytar`を利用し、お使いのOSのキーチェーンや認証情報マネージャーにAPIキーを安全に保存します。

*   **🛠️ 高いカスタマイズ性**:
    世界観、キャラクター、AIへの指示、各種プロンプトなど、シナリオを構成する要素はすべてMarkdownファイルとして管理されるため、ユーザーが自由にカスタマイズできます。

## 🚀 クイックスタート

1.  **拡張機能のインストール**:
    VS Codeの拡張機能マーケットプレイスから「Interactive Story Game Engine」をインストールします。

2.  **シナリオプロジェクトの初期化**:
    *   コマンドパレット (`Ctrl+Shift+P` または `Cmd+Shift+P`) を開きます。
    *   `Story Game: Initialize New Scenario Project` を実行します。
    *   シナリオを保存したい親フォルダを選択し、プロジェクト名を入力します。
    *   必要なフォルダと設定ファイルが自動で生成されるので、`Open Folder`ボタンでプロジェクトを開きます。

3.  **APIキーの設定**:
    *   コマンドパレットから `Story Game: Open Chat / Start Game` を実行してチャットパネルを開きます。
    *   初回利用時など、APIキーが未設定の場合は設定を促すメッセージが表示されます。
    *   指示に従い、お使いのLLMプロバイダー（デフォルトはOpenRouter）のAPIキーを設定してください。

4.  **ゲーム開始**:
    *   チャットパネルにゲームのオープニングメッセージが表示されたら、主人公（プレイヤー）の行動や発言を入力してAIとの対話を開始します。
    *   ゲームの進行状況は `logs/autosaves` フォルダに自動で保存されます。

## 📁 プロジェクト構造

`Initialize New Scenario Project` コマンドを実行すると、以下のような構造のプロジェクトが生成されます。

```
MyStoryGame/
├── .storygamesetting.json  # プロジェクト固有のLLMや記憶に関する設定
├── .gitignore              # Git管理対象外ファイルの設定
├── scenario/               # ゲームのシナリオ設定
│   ├── 00_world_setting.md     # 世界観・舞台設定
│   ├── 01_player_character.md  # 主人公（プレイヤー）設定
│   ├── 02_ai_rules.md          # AIへの行動指針
│   ├── 03_opening_scene.md     # ゲーム開始時のメッセージ
│   ├── characters/             # 登場人物（NPC）の設定ファイル
│   │   ├── chris_under.md
│   │   └── naruse_mai.md
│   └── prompts/                # LLMへのシステムプロンプト（カスタマイズ可能）
│       ├── character_update_prompt.md # キャラクター更新用
│       └── summarization_prompt.md    # 自動要約用
├── logs/                   # ゲームのセッションログ
│   ├── archives/               # 手動セーブやバックアップログ
│   └── autosaves/              # 自動保存ログ
├── summaries/              # 自動生成された物語の要約
│   └── latest_summary.json
└── exports/                # Markdown形式でエクスポートされたログ
```

## 📝 主なコマンド

コマンドパレットから以下のコマンドを実行できます。

| コマンド                                           | 説明                                                   |
| -------------------------------------------------- | ------------------------------------------------------ |
| `Story Game: Initialize New Scenario Project`      | 新しいシナリオプロジェクトを初期化します。             |
| `Story Game: Fork Scenario from Current Project`   | 現在のシナリオ設定をコピーして新しいプロジェクトを作成します。 |
| `Story Game: Open Chat / Start Game`               | AIと対話するチャットパネルを開き、ゲームを開始/再開します。 |
| `Story Game: Export Log to Markdown`               | 保存されたセッションログをMarkdown形式で出力します。     |

## ⚙️ 設定

VS Codeの設定画面 (`Ctrl+,` or `Cmd+,`) で `interactive-story` を検索すると、以下の項目を設定できます。

| 設定項目                                                 | 説明                                                                     | デフォルト値                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| `interactive-story.provider`                             | 使用するLLMプロバイダー (`openrouter` または `openai`)。                     | `openrouter`                                    |
| `interactive-story.model`                                | 使用するモデル名。 (例: `anthropic/claude-3.5-sonnet`)                     | `anthropic/claude-3.5-sonnet`                   |
| `interactive-story.endpoint`                             | チャットAPIのエンドポイント。                                              | `https://openrouter.ai/api/v1/chat/completions` |
| `interactive-story.temperature`                          | 生成されるテキストのランダム性 (0〜2)。                                    | `0.8`                                           |
| `interactive-story.maxTokens`                            | 一度の応答で生成する最大トークン数。                                       | `3000`                                          |
| `interactive-story.providerOptions.openrouter.httpReferer` | (OpenRouter用) `HTTP-Referer`ヘッダーに設定する値。                       | `""`                                            |
| `interactive-story.providerOptions.openrouter.xTitle`    | (OpenRouter用) アプリケーションを識別するための`X-Title`ヘッダー。      | `Interactive Story Game for VS Code`            |

## 🛠️ 開発者向け情報

1.  **依存関係のインストール**:
    ```bash
    npm install
    ```
2.  **ビルド**:
    ```bash
    npm run compile
    ```
    または、ファイルの変更を監視して自動でビルドする場合:
    ```bash
    npm run watch
    ```
3.  **デバッグ**:
    *   VS Codeでこのプロジェクトを開き、`F5`キーを押すと、拡張機能開発用の新しいVS Codeウィンドウが起動します。
    *   その新しいウィンドウでコマンドを実行し、動作を確認します。ソースコードにブレークポイントを設定してデバッグも可能です。