# なずな v15 — 管理画面強化

v15で追加した機能:

- 依頼番号検索
- 活動名検索
- 依頼区分検索
- 「新規のみ」ワンタップ絞り込み
- 新規件数表示
- 管理者専用メモ
- Discord通知から該当依頼を直接開くリンク
- `admin.html?request=NZ-xxxxxx` のディープリンク

v14のTurnstile、v13の受付停止連動、v12の管理画面機能はそのまま含まれています。

---

## 1. ファイルを反映

v15 ZIPから、現在のリポジトリへ主に以下を反映してください。

- docs/admin.html
- docs/admin.css
- docs/admin.js
- worker/src/index.js
- worker/migrations/002_admin_notes.sql

`worker/wrangler.jsonc` は置き換えないでください。

---

## 2. D1に管理者メモ用テーブルを追加

```bash
cd ~/u29Qrsite/worker

npx wrangler d1 execute u29qr-requests --remote --file=./migrations/002_admin_notes.sql
```

確認:

```bash
npx wrangler d1 execute u29qr-requests --remote --command "SELECT name FROM sqlite_schema WHERE type='table' AND name='request_admin';"
```

`request_admin` が出ればOKです。

---

## 3. Workerを再デプロイ

```bash
cd ~/u29Qrsite/worker
npx wrangler deploy
```

---

## 4. GitHubへ反映

```bash
cd ~/u29Qrsite

git add -A
git commit -m "Improve Nazuna admin dashboard"
git pull --rebase origin main
git push origin main
```

---

## 5. 管理画面テスト

https://jankyjankyjanky.github.io/u29Qrsite/admin.html

で確認します。

### 検索
検索欄へ:

- `NZ-000010`
- 活動名
- `MIX`

などを入力すると一致する依頼だけ表示されます。

### 新規件数
上部に:

`新規 3件`

のように表示されます。

### 管理者メモ
依頼詳細の最下部に「管理者メモ」があります。
依頼者には表示されません。

### Discordから直接開く
新しい依頼通知には「管理画面」のリンクが付きます。

クリックすると:

`admin.html?request=NZ-xxxxxx`

が開きます。

管理者キーがそのタブに保存されていなければログイン画面になります。
ログイン後、その依頼詳細を自動で開きます。

---

## 補足

古いDiscord通知にはリンクは追加されません。
v15デプロイ後に届く新しい通知から有効になります。

管理者キーは引き続きCloudflare Secret `ADMIN_TOKEN` に保存されています。
GitHubへは書きません。
