# 勤怠管理システム

ログインIDとパスワードで利用する、最小構成の勤怠管理アプリです。出勤・退勤の打刻と、月ごとの勤怠記録（日ごとの勤務時間と月合計）の確認ができます。

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
pnpm dev
```

http://localhost:3000 を開き、「新規登録」からアカウントを作成してください。

### データベースの切り替え

| 環境変数                | 動作                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` を設定   | PostgreSQL に接続します。マイグレーションは `pnpm db:migrate` で明示的に適用します。                                          |
| `DATABASE_URL` が未設定 | 組み込みの PGlite を使います。初回接続時にマイグレーションを自動適用します。                                                  |
| `PGLITE_DATA_DIR`       | PGlite のデータ保存先です。既定値は `memory://`（再起動で消えます）。`.pglite` のようにディレクトリを指定すると保存されます。 |

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
| `pnpm check`                | lint、typecheck、test をまとめて実行                                |

初回の E2E 実行前に `pnpm exec playwright install chromium` が必要です。

### PostgreSQL で結合テストを実行する

```bash
docker run -d --rm --name ams-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=attendance -p 55432:5432 postgres:17-alpine
export DATABASE_URL=postgres://postgres:postgres@localhost:55432/attendance
pnpm db:migrate
pnpm test:integration
docker stop ams-pg
```

テストはログインIDをテストごとに一意にしているため、データを消さずに同じデータベースで繰り返し実行できます。

## 構成

```
src/
  app/                 画面（/、/login、/signup）と API（app/api 配下）
  components/          クライアントコンポーネント（ダッシュボード、認証フォーム）
  client/              型付き API クライアントとクエリキー
  domain/              勤怠ロジック（純粋関数）
  server/
    auth/              パスワードハッシュ、セッション、Cookie
    db/                スキーマ、DB クライアント（PostgreSQL / PGlite）
    repositories/      DB アクセス
  shared/              API の zod スキーマと表示用フォーマッター
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

| メソッド | パス                                    | 内容                         |
| -------- | --------------------------------------- | ---------------------------- |
| POST     | `/api/auth/signup`                      | 新規登録してログイン         |
| POST     | `/api/auth/login`                       | ログイン                     |
| POST     | `/api/auth/logout`                      | ログアウト                   |
| GET      | `/api/me`                               | ログイン中のユーザー         |
| GET      | `/api/attendance/status`                | 現在の出勤状態               |
| POST     | `/api/attendance/clock-in`              | 出勤                         |
| POST     | `/api/attendance/clock-out`             | 退勤                         |
| GET      | `/api/attendance/records?month=YYYY-MM` | 月の勤怠記録（省略時は今月） |

## 今後の課題

- 休憩時間の記録
- 管理者向けの画面（全ユーザーの勤怠確認）
- 打刻の編集・修正
- パスワードリセット
- 期限切れセッションの定期削除とログイン試行回数の制限
