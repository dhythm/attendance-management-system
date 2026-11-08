# 勤怠管理システム

ログインIDとパスワードで利用する、最小構成の勤怠管理アプリです。出勤・退勤の打刻と、月ごとの勤怠記録（日ごとの勤務時間と月合計）の確認ができます。アカウントは管理者が発行し、権限に応じてマネージャー向けの勤怠一覧やユーザー管理を使えます。

## 権限

| 権限                    | 打刻・自分の勤怠 | 全員の勤怠（`/manager`） | ユーザー管理（`/admin/users`） |
| ----------------------- | :--------------: | :----------------------: | :----------------------------: |
| 一般社員（employee）    |        ○         |                          |                                |
| マネージャー（manager） |        ○         |            ○             |                                |
| アドミン（admin）       |        ○         |            ○             |               ○                |

- 権限ごとにできることは `src/domain/role.ts` の対応表1か所で定義しています。API は権限がなければ 403 `FORBIDDEN` を返し、画面はトップページへ戻します。
- 権限はリクエストごとにデータベースから読むため、変更は対象ユーザーの次の操作から反映されます（再ログイン不要）。
- アドミンが1人もいない状態にはできません。最後のアドミンの権限を変更しようとすると 409 `LAST_ADMIN` になります。
- 自分でアカウントを作る新規登録はありません。アドミンが「ユーザー管理」でログインID・表示名・初期パスワード・権限を指定して発行します。

## 技術スタック

- Next.js 16（App Router、Route Handlers）
- TanStack Query（フロントエンドと API の通信）
- Drizzle ORM（本番は PostgreSQL、CI・ローカル検証は PGlite）
- zod（リクエスト・レスポンスの検証）
- Vitest（単体・結合テスト）、Playwright（E2E テスト）
- Biome（リンター・フォーマッター）、TypeScript 7（型チェック）

## 必要なもの

- Node.js 24 以上
- pnpm 10

## セットアップ

```bash
pnpm install
cp .env.example .env.local
# .env.local の SEED_PASSWORD に8文字以上のパスワードを設定する
pnpm db:seed
pnpm dev
```

http://localhost:3000 を開き、下のデモアカウントでログインしてください。

### デモデータ

`pnpm db:seed` は次の4アカウントと、過去2週間の平日の勤怠（日本時間 9:00〜18:00 前後）を投入します。パスワードはすべて `SEED_PASSWORD` に設定した値です。

| ログインID | 表示名            | 権限         | 勤怠                            |
| ---------- | ----------------- | ------------ | ------------------------------- |
| `admin`    | アドミン          | アドミン     | なし                            |
| `manager`  | マネージャー 佐藤 | マネージャー | 過去2週間の平日                 |
| `yamada`   | 山田 太郎         | 一般社員     | 過去2週間の平日と、今日の勤務中 |
| `suzuki`   | 鈴木 花子         | 一般社員     | 過去2週間の平日                 |

- 何度実行しても同じ状態になります。4アカウントはログインIDで上書きし、その勤怠は実行時点を基準に作り直します（デモアカウントで打刻した記録は消えます）。時刻のばらつきは日付とログインIDから決まるため、同じ日に実行すれば同じデータになります。
- `SEED_PASSWORD` が未設定または8文字未満のときはエラーで終了します。パスワードはコードに含めていません。
- 動作確認用です。本番の PostgreSQL に対して実行しないでください（同じログインIDの既存ユーザーを上書きします）。
- `SEED_DEMO_DATA=true` を設定すると、PGlite の起動時に同じデモデータを自動で投入します。`memory://` で起動する開発・E2E 環境向けです（PostgreSQL では動作しません）。
- ファイル保存の PGlite（`PGLITE_DATA_DIR=.pglite`）は1プロセスしか開けません。`pnpm db:seed` は `pnpm dev` を止めてから実行してください。

### 本番環境の最初のアドミン

本番ではデモデータを使わず、最初のアドミンを環境変数から作成します。既に同じログインIDのアドミンがいる場合は何も変更しません。アドミン以外のアカウントが同じログインIDを使っている場合は、権限を上げずにエラーで終了します。

```bash
export DATABASE_URL=postgres://...
export ADMIN_LOGIN_ID=admin ADMIN_DISPLAY_NAME="管理者" ADMIN_PASSWORD='...'
pnpm db:migrate
pnpm db:create-admin
```

以降のアカウントは、このアドミンで「ユーザー管理」から発行します。

### データベースの切り替え

| 環境変数                | 動作                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` を設定   | PostgreSQL に接続します。マイグレーションは `pnpm db:migrate` で明示的に適用します。                                          |
| `DATABASE_URL` が未設定 | 組み込みの PGlite を使います。初回接続時にマイグレーションを自動適用します。                                                  |
| `PGLITE_DATA_DIR`       | PGlite のデータ保存先です。既定値は `memory://`（再起動で消えます）。`.pglite` のようにディレクトリを指定すると保存されます。 |
| `SEED_DEMO_DATA=true`   | PGlite の起動時にデモデータを投入します（`SEED_PASSWORD` が必要）。                                                           |

本番環境では必ず `DATABASE_URL` を設定してください。`drizzle-kit` は `.env` を読み込まないため、`pnpm db:migrate` を実行するシェルで `DATABASE_URL` を export してください。

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/attendance
pnpm db:migrate
pnpm build && pnpm start
```

## スクリプト

| コマンド                    | 内容                                                                |
| --------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                  | 開発サーバーを起動                                                  |
| `pnpm build` / `pnpm start` | 本番ビルドと起動                                                    |
| `pnpm lint`                 | Biome によるリントとフォーマット確認                                |
| `pnpm format`               | Biome で整形                                                        |
| `pnpm typecheck`            | ルート型を生成して `tsc --noEmit`                                   |
| `pnpm test`                 | 単体テストと結合テスト（PGlite）                                    |
| `pnpm test:integration`     | 結合テストのみ。`DATABASE_URL` を設定すると PostgreSQL に対して実行 |
| `pnpm test:e2e`             | 本番ビルドを起動して Playwright で E2E テスト                       |
| `pnpm db:generate`          | スキーマからマイグレーションを生成                                  |
| `pnpm db:migrate`           | `DATABASE_URL` の PostgreSQL にマイグレーションを適用               |
| `pnpm db:seed`              | デモアカウントと勤怠を投入（`SEED_PASSWORD` が必要）                |
| `pnpm db:create-admin`      | `ADMIN_LOGIN_ID` などの環境変数から最初のアドミンを作成             |
| `pnpm check`                | lint、typecheck、test をまとめて実行                                |

`pnpm db:seed` と `pnpm db:create-admin` は `.env.local` があれば読み込みます。既に export した環境変数が優先されます。

初回の E2E 実行前に `pnpm exec playwright install chromium` が必要です。E2E は `memory://` の PGlite を `SEED_DEMO_DATA=true` で起動し、デモアカウントでログインします（テスト用のパスワードは `tests/e2e/demo.ts`）。

### PostgreSQL で結合テストを実行する

```bash
docker run -d --rm --name ams-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=attendance -p 55432:5432 postgres:17-alpine
export DATABASE_URL=postgres://postgres:postgres@localhost:55432/attendance
pnpm db:migrate
pnpm test:integration
SEED_PASSWORD=demo-password pnpm db:seed
docker stop ams-pg
```

テストはログインIDをテストごとに一意にしているため、データを消さずに同じデータベースで繰り返し実行できます。データベース全体のアドミン数を数える「最後のアドミン」のテストだけは、テストごとに使い捨てのデータベースを作成して削除します（`CREATE DATABASE` の権限が必要です）。

## 構成

```
src/
  app/                 画面（/、/login、/manager、/admin/users）と API（app/api 配下）
  components/          クライアントコンポーネント（ダッシュボード、勤怠一覧、ユーザー管理など）
  client/              型付き API クライアントとクエリキー
  domain/              勤怠ロジックと権限の対応表（純粋関数）
  server/
    auth/              パスワードハッシュ、セッション、Cookie
    db/                スキーマ、DB クライアント（PostgreSQL / PGlite）、デモデータ
    repositories/      DB アクセス
  shared/              API の zod スキーマと表示用フォーマッター
scripts/               db:seed と db:create-admin の CLI
drizzle/               マイグレーション
tests/integration/     Route Handler の結合テスト
tests/e2e/             Playwright の E2E テスト
```

## 仕様

- 出勤状態は保存せず、退勤していない記録の有無から導出します。1ユーザーにつき未退勤の記録は1件だけで、データベースの部分ユニークインデックスでも保証します（二重クリックや同時リクエストは 409 になります）。
- 日付と月の境界は日本時間（Asia/Tokyo）で計算します。日付をまたぐ勤務は出勤した日の記録として扱います。
- 月合計には退勤済みの記録だけを含めます。
- パスワードは scrypt（ユーザーごとのソルト付き）でハッシュ化します。セッショントークンは httpOnly Cookie に保存し、データベースには SHA-256 ハッシュのみ保存します。有効期限は7日です。
- API のエラーは `{ "error": { "code": "...", "message": "..." } }` 形式で返します。

### API

| メソッド | パス                                           | 内容                                                     |
| -------- | ---------------------------------------------- | -------------------------------------------------------- |
| POST     | `/api/auth/login`                              | ログイン                                                 |
| POST     | `/api/auth/logout`                             | ログアウト                                               |
| GET      | `/api/me`                                      | ログイン中のユーザー（権限を含む）                       |
| GET      | `/api/attendance/status`                       | 現在の出勤状態                                           |
| POST     | `/api/attendance/clock-in`                     | 出勤                                                     |
| POST     | `/api/attendance/clock-out`                    | 退勤                                                     |
| GET      | `/api/attendance/records?month=YYYY-MM`        | 月の勤怠記録（省略時は今月）                             |
| GET      | `/api/manager/users?month=YYYY-MM`             | 全ユーザーの現在の状況と月の勤務時間（マネージャー以上） |
| GET      | `/api/manager/users/:id/records?month=YYYY-MM` | 指定ユーザーの月の勤怠記録（マネージャー以上）           |
| GET      | `/api/admin/users`                             | ユーザー一覧（アドミン）                                 |
| POST     | `/api/admin/users`                             | ユーザーを発行（アドミン）                               |
| PATCH    | `/api/admin/users/:id`                         | 権限を変更（アドミン）                                   |

## 今後の課題

- 休憩時間の記録
- チーム・部署の概念（現在はマネージャーが全員の勤怠を見られます）
- 打刻の編集・修正
- パスワードリセット（初期パスワードの変更を含む）
- ユーザーの削除・無効化
- 期限切れセッションの定期削除とログイン試行回数の制限

## ライセンス

[MIT License](LICENSE)
