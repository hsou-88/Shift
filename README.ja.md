# 掃除シフト予約

Cloudflare Pages FunctionsとD1を使った、サーバーレスの掃除シフト予約アプリです。画面に表示される文章は英語です。

## 予約ルール

- 管理者は予約期間、新入寮者・既存入寮者それぞれの予約曜日と1日あたりの定員を設定できます。
- 管理者が新入寮者の部屋番号リストを登録します。リストにある部屋番号は新入寮者、それ以外は既存入寮者としてサーバーが判定します。予約者自身はグループを選べません。
- 予約枠はグループと日付ごとに別々に数えます。新入寮者と既存入寮者で曜日を分ける設定もできます。
- 1つの部屋番号で予約できるのは1回です。予約登録時にデータベース側でグループ別の定員を確認します。
- `/admin` は8時間有効の署名付きHTTP-onlyセッションで保護されています。`ADMIN_KEY` を使って `/admin-login.html` からログインしてください。
- 初期設定は新入寮者が水曜日、既存入寮者が日曜日です。管理者画面からそれぞれ変更できます。曜日は部屋番号の奇数・偶数では決まりません。

## Cloudflare無料枠でのデプロイ

1. Cloudflareアカウントと、このアプリ用の空のGitHubリポジトリを作成します。この作業フォルダーはまだGitリポジトリではありません。PowerShellでこのフォルダーを開き、GitHubで作成したリポジトリのURLに置き換えて次を実行します。

   ```powershell
   git init
   git add .
   git commit -m "Prepare Cloudflare booking app"
   git branch -M main
   git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
   git push -u origin main
   ```

   `.dev.vars` はGitに登録しないでください。`.gitignore` に登録済みです。

2. Cloudflareで `cleaning-shift-booking` という名前のD1データベースを作成します。データベースIDを `wrangler.toml` の `REPLACE_WITH_D1_DATABASE_ID` と置き換え、ファイルをコミットしてGitHubへpushします。
3. 依存パッケージを `npm install` でインストールし、`npx wrangler login` でWranglerを認証します。
4. `npm run db:apply:remote` を実行して、Cloudflare上のデータベースに初期スキーマを適用します。
5. Cloudflareの **Workers & Pages → Create application → Pages → Connect to Git** からGitHubリポジトリを選びます。リポジトリ内の `wrangler.toml` を使用し、Pagesの出力ディレクトリは `.` にします。
6. Pagesプロジェクトの **Settings → Variables and Secrets** で、本番環境用のSecret `ADMIN_KEY` を登録します。32文字以上のランダムな値を使い、GitHubには登録しないでください。
7. プレビュー用の別D1データベースを用意しない場合は、プレビュー自動デプロイを無効にします。有効なまま本番データベースを共有すると、プレビュー版から本番の予約にアクセスできる可能性があります。
8. デプロイ後、発行された `*.pages.dev` のURLを予約ページとして利用します。管理者ログインURLは、そのURLの末尾に `/admin-login.html` を付けたものです。

本番環境では常時起動するNode.jsサーバーは使いません。Pagesが静的ファイルを配信し、`functions/api/` の処理をサーバーレスFunctionとして実行します。共有設定と予約はD1に保存します。D1のバインディング名は `wrangler.toml` にある `DB` です。

Cloudflare無料枠の現在の目安は、Pages Functions／Workersのリクエストが1日10万回、D1の読み取りが1日500万行、書き込みが1日10万行、保存容量が合計5GBです。静的ファイルの配信は無料・無制限です。無料枠の上限を超えると、リクエストやデータベース処理が失敗する場合があります。独自ドメインを取得する場合は、別途費用がかかることがあります。デプロイ前に[Cloudflareの最新料金](https://developers.cloudflare.com/workers/platform/pricing/)を確認してください。

## ローカルでのプレビュー

Node.js 22または24とnpmが必要です。上記の手順でD1を作成し、`wrangler.toml` にデータベースIDを設定してください。

プロジェクトのルートに `.dev.vars` ファイルを作成します。このファイルはGitに登録されません。

```text
ADMIN_KEY=32文字以上のランダムな秘密鍵を指定
```

ローカル用D1データベースにスキーマを適用してから、プレビューを起動します。

```sh
npm install
npm run db:apply:local
npm run dev
```

Wranglerはローカル開発中、D1のデータをローカルに保存します。`npm run db:apply:remote` はCloudflare上のデータベースを変更するため、意図した場合にだけ実行してください。

## 入居者本人の確認について

管理者が登録した部屋番号リストによって予約グループを判定し、同じ部屋番号の重複予約を防ぎます。ただし、入力者がその部屋の入居者本人かどうかは確認しません。本人確認が必要な場合は、入居者ログインなどの認証機能を追加してください。
