# POTA Client Electron

POTA（Parks on the Air）アプリ（https://pota.app）をElectronで表示し、ページが自動的に行っているAPIリクエストを監視して新しいスポットを検知した際にフィルタ条件に基づいてデスクトップ通知を表示するデスクトップアプリケーションです。

## 機能

- **POTAアプリの表示**: https://pota.app をElectronアプリ内で表示
- **自動監視**: ページが自動的に行っているAPIリクエストを監視して新しいスポットを検知
- **フィルタリング**: reference、comments、modeフィールドに対して柔軟なフィルタ条件を設定可能
  - フィルタタイプ: 「含まれている」（部分一致）、「完全一致」（大文字小文字区別なし）
  - フィールド間: AND条件（全てのフィールドを通過する必要がある）
  - フィールド内: AND/OR選択可能
  - 除外機能: 条件に一致したものを除外可能
- **デスクトップ通知**: フィルタ条件を通過した新しいスポットをデスクトップ通知で表示

## セットアップ

### 必要な環境

- Node.js (v16以上推奨)
- npm または yarn

### インストール

```bash
# 依存関係をインストール
npm install

# アプリケーションを起動
npm start
```

## 使用方法

### 基本的な使い方

1. アプリケーションを起動すると、POTAアプリ（https://pota.app）が表示されます
2. メニューから設定画面を開く（実装に応じて追加）
3. フィルタ条件を設定
4. 新しいスポットが検知され、フィルタ条件を通過した場合にデスクトップ通知が表示されます

### フィルタ設定

設定画面では、以下のフィールドに対してフィルタ条件を設定できます：

- **Reference**: パークのリファレンスコード（例: US-1234）
- **Comments**: コメントフィールド
- **Mode**: 通信モード（例: FT8, CW, SSB）

各フィールドで：

1. **条件の結合方法を選択**: OR（いずれか一致）またはAND（全て一致）
2. **条件を追加**: 「条件を追加」ボタンをクリック
3. **フィルタタイプを選択**: 「含まれている」または「完全一致」
4. **除外オプション**: チェックボックスで条件に一致したものを除外
5. **保存**: 設定を保存

### フィルタ適用ロジック

- **フィールド間**: AND条件（reference AND comments AND mode全てを通過する必要がある）
- **フィールド内**: 選択したAND/OR条件に基づいて判定
- **除外条件**: 除外条件に一致する場合は通知しない（最優先）

例：
- reference: 「US-」を含む（OR条件）
- comments: 「FT8」が完全一致 AND 「RBN」を含む（AND条件）
- mode: 「CW」が完全一致

上記全てを満たす場合のみ通知されます。

## プロジェクト構造

```
pota_client_electron/
├── package.json          # プロジェクト設定と依存関係
├── main.js              # Electronメインプロセス（ウィンドウ管理、AJAX監視）
├── preload.js           # セキュリティのためのpreloadスクリプト
├── settings.html        # 設定画面のHTML
├── settings.js          # 設定画面のロジックとUI制御
├── filter.js            # フィルタロジック（条件チェック）
├── .gitignore           # Git除外ファイル
└── README.md            # プロジェクト説明
```

## 設定の保存場所

設定ファイルは `config.json` として、Electronのユーザーデータディレクトリに保存されます：

- **Windows**: `%APPDATA%\pota-client-electron\config.json`
- **macOS**: `~/Library/Application Support/pota-client-electron/config.json`
- **Linux**: `~/.config/pota-client-electron/config.json`

## 開発

### 開発モードで起動

```bash
npm run dev
```

### ビルド

本番環境用の実行ファイルを作成するには、以下のコマンドを実行します：

```bash
# Windows用のインストーラーとポータブル版を作成
npm run build

# Windows用のみ（インストーラー + ポータブル版）
npm run build:win

# Windows用ポータブル版のみ
npm run build:win:portable
```

ビルドされたファイルは `dist` ディレクトリに出力されます：

- **インストーラー版**: `POTA Notification Setup 1.0.0.exe` - インストール用のセットアップファイル
- **ポータブル版**: `POTA Notification 1.0.0.exe` - インストール不要で直接実行可能なファイル

#### ビルドオプション

- **インストーラー版（NSIS）**: インストール先の選択、デスクトップショートカットの作成が可能
- **ポータブル版**: インストール不要で、USBメモリなどから直接実行可能

## ライセンス

MIT

## 謝辞

- [POTA.app](https://pota.app) - Parks on the Airアプリケーション
- [Electron](https://www.electronjs.org/) - デスクトップアプリケーションフレームワーク

