はい、承知いたしました。提供されたプロジェクトのファイル構造とコード内容を分析し、GitHub用の日本語README.mdを作成します。

---

# Novel Assistant (小説執筆アシスタント)

[![Visual Studio Marketplace](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://marketplace.visualstudio.com/VSCode)

**Novel Assistant** は、VS Code上で動作する、LLM（大規模言語モデル）を活用した長編小説執筆支援ツールです。

長編小説の執筆は、壮大な世界観、魅力的なキャラクター、そして複雑に絡み合う伏線を管理する大変な作業です。この拡張機能は、LLMの力を借りて執筆プロセスを効率化し、物語の整合性を保つ手助けをします。

## ✨ 主な機能

*   **📝 プロジェクトの自動セットアップ**:
    小説執筆に必要なディレクトリ構造（設定資料、本文、アウトライン等）とテンプレートファイルをワンコマンドで生成します。

*   **💬 AIとの対話による執筆**:
    チャット形式のUIでAIと対話しながら、物語のプロットや本文を生成できます。キャラクター設定や世界観などのプロジェクト情報を自動でコンテキストに含めるため、AIは物語の設定を深く理解した上で執筆をアシストします。

*   **🤖 保存時の自動後処理パイプライン**:
    執筆した章のファイルを保存するたびに、以下の処理がバックグラウンドで自動的に実行されます。
    *   **章の自動要約**: LLMが章の内容を読み取り、数文の要約を自動で生成・保存します。
    *   **伏線リストの自動更新**: 本文中で新たに提示された謎や回収された伏線をLLMが検出し、伏線管理ファイル（`foreshadows.tsv`）の更新案を生成します。
    *   **整合性チェック**: キャラクターの口調、世界観のルール、時系列などが設定資料と矛盾していないかをLLMがチェックし、レポートを作成します。

*   **🔐 安全なAPIキー管理**:
    `keytar`を利用し、お使いのOSのキーチェーンや認証情報マネージャーにAPIキーを安全に保存します。

*   **⚙️ 高いカスタマイズ性**:
    LLMに与えるプロンプトテンプレートはすべてプロジェクト内のファイルとして管理されるため、ユーザーが自由にカスタマイズできます。

## 🚀 クイックスタート

1.  **拡張機能のインストール**:
    VS Codeの拡張機能マーケットプレイスから「Novel Assistant」をインストールします。

2.  **プロジェクトの初期化**:
    *   コマンドパレット (`Ctrl+Shift+P` または `Cmd+Shift+P`) を開きます。
    *   `Novel: Initialize Story Project` を実行します。
    *   物語プロジェクトを保存したい親フォルダを選択し、プロジェクト名を入力します。
    *   必要なフォルダと設定ファイルが自動で生成されるので、`Open Folder`ボタンでプロジェクトを開きます。

3.  **APIキーの設定**:
    *   コマンドパレットから `Novel: Open Chat` を実行してチャットパネルを開きます。
    *   初回利用時など、APIキーが未設定の場合は設定を促すメッセージが表示されます。
    *   指示に従い、お使いのLLMプロバイダー（デフォルトはOpenRouter）のAPIキーを設定してください。

4.  **執筆開始**:
    *   チャットパネルで「第1章、主人公の茜が古い教会で謎のペンダントを見つけるシーンを書いて」のように、執筆したい内容をAIに指示します。
    *   生成された本文を `chapters` フォルダ内のMarkdownファイルにコピー＆ペーストして保存します。
    *   保存すると、自動後処理（要約、伏線更新、整合性チェック）が実行されます。結果は `summaries` や `reports` フォルダに保存されます。

## 📁 プロジェクト構造

`Initialize Story Project` コマンドを実行すると、以下のような構造のプロジェクトが生成されます。

```
MyStory/
├── .novelrc.json         # プロジェクト固有の設定ファイル
├── bible/                # 物語の「聖書」となる設定資料
│   ├── characters.md     # 登場人物設定
│   ├── world.md          # 世界観・ルール設定
│   ├── rules.md          # 文体・作風ルール
│   └── foreshadows.tsv   # 伏線管理シート
├── chapters/             # 各章の本文（.md形式）
├── outline/              # 物語の構成案
│   ├── timeline.md       # 時系列
│   └── arc_map.md        # 章ごとのプロット
├── prompts/              # LLMへの指示テンプレート（カスタマイズ可能）
│   ├── generation.md     # 本文生成用
│   ├── summarization.md  # 要約生成用
│   ├── foreshadow_update.md # 伏線更新用
│   └── consistency_check.md # 整合性チェック用
├── reports/              # 整合性チェックのレポート
└── summaries/            # 各章の自動生成された要約
```

## 📝 主なコマンド

コマンドパレットから以下のコマンドを実行できます。

| コマンド                                     | 説明                                                   |
| -------------------------------------------- | ------------------------------------------------------ |
| `Novel: Initialize Story Project`            | 新しい小説プロジェクトを初期化します。                 |
| `Novel: Open Chat`                           | AIと対話しながら執筆できるチャットパネルを開きます。     |
| `Novel: Create Chapter from Template`        | テンプレートから新しい章のファイルを作成します。       |
| `Novel: Run Consistency Checks for Current Chapter` | 現在開いている章ファイルの整合性チェックを手動で実行します。 |
| `Novel: Rebuild Foreshadow Index`            | (実装予定) 伏線インデックスを再構築します。            |
| `Novel: Export Report (HTML)`                | (実装予定) 各種レポートをHTML形式で出力します。        |

## ⚙️ 設定

VS Codeの設定画面 (`Ctrl+,` or `Cmd+,`) で `novelAssistant` を検索すると、以下の項目を設定できます。

| 設定項目                                           | 説明                                                                     | デフォルト値                          |
| -------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| `novelAssistant.provider`                          | 使用するLLMプロバイダー (`openrouter` または `openai`)。                     | `openrouter`                          |
| `novelAssistant.model`                             | 使用するモデル名。 (例: `anthropic/claude-3.5-sonnet`)                     | `anthropic/claude-3.5-sonnet`         |
| `novelAssistant.endpoint`                          | チャットAPIのエンドポイント。                                              | `https://openrouter.ai/api/v1/...`    |
| `novelAssistant.temperature`                       | 生成されるテキストのランダム性 (0〜2)。                                    | `0.7`                                 |
| `novelAssistant.maxTokens`                         | 一度の応答で生成する最大トークン数。                                       | `3000`                                |
| `novelAssistant.providerOptions.openrouter.httpReferer` | (OpenRouter用) `HTTP-Referer`ヘッダーに設定する値。                       | `""`                                  |
| `novelAssistant.providerOptions.openrouter.xTitle` | (OpenRouter用) アプリケーションを識別するための`X-Title`ヘッダー。      | `Novel Assistant for VS Code`         |

---