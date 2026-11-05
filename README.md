# 医薬品学習アプリ PWA版

## 1. 起動・公開方法

PWAのインストールとオフライン機能を有効にするには、HTTPSまたはlocalhostから配信してください。HTMLをダブルクリックして開く `file://` 方式では、Service WorkerとPWAインストールは利用できません。

### Windowsでローカル確認

1. このフォルダーを展開します。
2. `start-local-server.bat` をダブルクリックします（Pythonがインストールされていること）。
3. ブラウザで `http://localhost:8000/` を開きます。
4. 動作確認後、HTTPS対応のWebサーバーにフォルダー全体を配置します。

Pythonを使わず起動する場合は、PowerShell/ターミナルでフォルダー内から `python -m http.server 8000` を実行します。

## 2. 共通パスワードの設定場所

`data/config.js` をテキストエディターで開き、次の値を変更します。

```js
SHARED_PASSWORD: "CHANGE-THIS-PASSWORD",
PASSWORD_IS_DEFAULT: true
```

たとえば、十分に長い独自の文字列へ変更し、`PASSWORD_IS_DEFAULT` を `false` にします。変更後、ファイルを保存してサーバーに再配置し、アプリをオンライン状態で再読み込みしてください（`config.js` はオンライン時にサーバーから更新されます）。

**重要なセキュリティ上の制約：** このプロジェクトはHTML/JavaScriptだけで動作する静的PWAです。`data/config.js` はブラウザへ配信されるため、利用者は開発者ツールやファイル取得でパスワードを確認できます。したがって、このログインは家族・小規模グループ内の簡易的な入口制御であり、機密情報の保護、利用者ごとの権限管理、外部からの不正アクセス対策にはなりません。外部公開や機密データを扱う場合は、サーバー側でパスワードを照合する認証（HTTPS、セッション、レート制限等）に置き換えてください。

## 3. アイコン画像の変更方法

`icons/` の以下のPNGを、同じファイル名・同じ推奨サイズで差し替えてください。

- `icon-192.png`：192×192px（Android/Chromium用）
- `icon-512.png`：512×512px（インストール画面・高解像度用）
- `apple-touch-icon.png`：180×180px（iPhone/iPad用）
- `icon.svg`：編集用のベクター元データ。タブのファビコンにも使います。

ファイル名を変更する場合は、`manifest.json` の `icons[].src` と `index.html` および `1.indel.html` の `rel="apple-touch-icon"` / `rel="icon"` も同じ名前に変更してください。差し替え後、Service Workerのキャッシュが残る場合はサイトデータを消去するか、`service-worker.js` の `CACHE_NAME` の末尾バージョンを更新して再読み込みしてください。iPhoneではホーム画面から旧アイコンを削除して再追加してください。

## 4. ファイル構成

```text
index.html                 PWAの標準起動ファイル
1.indel.html               ご指定名のHTML（index.htmlと同内容）
2.style.css                親画面のデザイン・レスポンシブ対応
3.app.js                   ログイン、画面遷移、データ連携、CSV出力、PWA登録
manifest.json              アプリ名、起動URL、表示方法、アイコン
service-worker.js          オフラインキャッシュ
database.js                端末内の設定・学習データ保存窓口
data/
  config.js                管理者が共通パスワードを設定するファイル
  medicines.json           医薬品データ用JSON
  questions.json           問題データ用JSON（現状は医薬品データから自動生成）
  flashcards.json          暗記カード用JSON（現状は医薬品データから自動生成）
modules/
  quiz-app.html / quiz.css / quiz.js
  flashcard-app.html / flashcards.css / flashcards.js
icons/                     PWA・iOS用アイコン
```

`modules/` は元ファイルにBase64で埋め込まれていたクイズ画面と暗記カード画面を独立させたものです。各モード固有のCSS/JavaScriptも分離しています。`3.app.js` が親画面とのデータ受け渡しと画面制御を担当します。

## 5. 医薬品データとJSON形式

親画面では従来どおり `販売名,一般名,薬効` を1行ずつ貼り付けられます。また「JSONを読み込む」から次の形式のJSONファイルも読み込めます。

```json
{
  "items": [
    {
      "salesName": "販売名",
      "genericName": "一般名",
      "effect": "薬効"
    }
  ]
}
```

`data/medicines.json` はこの形式の初期テンプレートです。元のHTMLには医薬品データ自体は含まれていなかったため、移行後のJSONも空配列にしています。実際の医薬品名・一般名・薬効は、使用者側で信頼できる最新資料を確認して登録してください。`questions.json` と `flashcards.json` はデータ構造を置くための空テンプレートです。現在の出題・カードは登録された医薬品情報と6種類の出題方向から自動生成されます。

## 6. 誤答CSV出力

共通メニューの「誤答CSV出力」を押すと、過去の誤答をCSVで保存します。誤答は最大1,000件まで端末に保存し、CSVでは保存されている誤答を出力します。項目は **誤答日時、出題形式、問題、正答、入力内容** の5列です。Excelで日本語が文字化けしにくいようUTF-8 BOM付きで出力します。

## 7. 保存方式とオフライン利用

学習履歴・誤答・ブックマーク・設定はブラウザのlocalStorageに保存されます。データは利用したブラウザ・端末ごとに保存され、別端末や別ブラウザには自動同期されません。ブラウザのサイトデータを削除すると保存内容も失われます。Service Workerはアプリ本体とモジュール・初期データをキャッシュし、初回オンライン起動後のオフライン利用を可能にします。

## 8. 対応ブラウザ

- Windows/macOS/Linuxデスクトップ：Chrome / EdgeでmanifestベースのPWAインストール。macOS Sonoma（Safari 17）以降はSafariの「Dockに追加」。Firefoxデスクトップは通常のWeb利用に対応しますが、manifestによる標準PWAインストールは非対応です。
- Android：Chrome、Samsung Internetでホーム画面へのPWAインストール。Firefox/Edge等は環境によりブラウザー付きショートカットになります。
- iOS/iPadOS：16.4以降は共有メニューからホーム画面に追加できます。iOS 16.3以前はSafariのみです。
- どの環境でも、アプリ本体は現行の主要ブラウザでの利用を想定しています。PWAインストール・Service WorkerにはHTTPSまたはlocalhostが必要です。

互換性はブラウザとOSの更新で変わるため、配布前に実機で確認してください。

参考：MDN「PWA をインストール可能にする」 https://developer.mozilla.org/ja/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
