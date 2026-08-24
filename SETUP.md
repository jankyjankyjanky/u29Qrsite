# u29Qr 依頼サイト v10 セットアップ

この版では次の流れまで実装しています。

1. `request.html` で依頼内容を確認
2. 「依頼を送信」
3. Firebase Cloud Functions の `submitRequest` を呼び出す
4. Firestore の `requests` に依頼を保存
5. `U29-000001` のような依頼番号を自動発行
6. Discord Bot から指定したあなたのDMへ「新しい依頼が届きました」と通知
7. `thanks.html` に依頼番号を表示

## 重要

Discord Bot Token は `public/` のJavaScriptには絶対に書きません。
Bot Token は Firebase Functions の Secret に保存します。

Firebase のWeb用 `firebaseConfig` は秘密鍵ではないため、ブラウザ側に置く通常の構成で問題ありません。

---

## 1. Firebaseプロジェクトを作る

Firebase Consoleでプロジェクトを作成します。

その後、

- Webアプリを追加
- Cloud Firestoreを有効化
- Firebase Hostingを有効化
- Cloud Functionsを使用できる状態にする

まで進めます。

Cloud Functionsのデプロイには、Firebaseプロジェクトで請求先設定が必要になる場合があります。

---

## 2. Webアプリの設定を貼る

Firebase Consoleの

`プロジェクトの設定 → マイアプリ → Webアプリ → SDK の設定と構成`

にある `firebaseConfig` を確認します。

`public/firebase-config.js` の

```js
export const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

を、自分の値に置き換えてください。

---

## 3. Discord Botを作る

Discord Developer Portalで新しいApplicationを作成し、Botを追加します。

Bot Tokenを取得してください。

Botは、通知を受け取る自分と同じDiscordサーバーに参加させてください。
DMを受け取れる設定になっている必要があります。

次にDiscordで開発者モードを有効にし、自分自身を右クリックして「ユーザーIDをコピー」します。

必要なのは、

- Discord Bot Token
- あなたのDiscord User ID

の2つです。

---

## 4. Firebase CLIを準備

Node.jsをインストールした状態で、ターミナルから実行します。

```bash
npm install -g firebase-tools
firebase login
```

このプロジェクトフォルダへ移動して、

```bash
firebase use --add
```

を実行し、作成したFirebaseプロジェクトを選択します。

---

## 5. Functionsの依存関係を入れる

```bash
cd functions
npm install
cd ..
```

---

## 6. Discord情報をSecretへ登録

Bot Token:

```bash
firebase functions:secrets:set DISCORD_BOT_TOKEN
```

入力を求められたらBot Tokenを貼ります。

あなたのDiscord User ID:

```bash
firebase functions:secrets:set DISCORD_USER_ID
```

入力を求められたらDiscordのユーザーIDを貼ります。

**Bot TokenをHTML・request.js・firebase-config.jsへ貼らないでください。**

---

## 7. デプロイ

プロジェクトのルートで、

```bash
firebase deploy
```

を実行します。

完了するとFirebase HostingのURLが表示されます。

---

## Firestoreに保存されるもの

`requests` コレクションに、たとえば次のように保存されます。

```text
requests/
  自動生成ドキュメントID
    requestId: "U29-000001"
    status: "new"
    quoteStatus: "site-estimate"
    applicant: ...
    estimate: ...
    discordNotified: true
    createdAt: ...
```

依頼番号用のカウンターは、

```text
system/requestCounter
```

に保存されます。

---

## Discord通知例

```text
📩 新しい依頼が届きました

U29-000001
依頼者: ○○
依頼内容: MIX予算
サイト見積り: 3,500円
希望納期: 2026-09-10
```

詳しい連絡先・素材URL・要望などはDiscordへ大量に流さず、
Firestore側で確認する構成にしています。

---

## 現在のFirestoreルール

`firestore.rules` はブラウザからの直接読み書きを全面的に禁止しています。

依頼登録はCloud Functions内のAdmin SDKだけが行います。

これは、利用者がブラウザから直接 `requests` を読んだり書き換えたりしにくくするためです。

---

## 次に追加できるもの

次の段階では、管理者だけがログインできる `admin/` を作り、

- 新規
- 確認済み
- 相談中
- 入金待ち
- 制作中
- 確認待ち
- 納品済み

などのステータス管理を行えるようにできます。

※ サイト上の金額は「自動見積り」です。正式な請求額として自動決済する構成にはしていません。
