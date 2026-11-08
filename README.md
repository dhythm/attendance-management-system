# 勤怠管理システム

ログインIDとパスワードで利用する、最小構成の勤怠管理アプリです。出勤・退勤の打刻と、月ごとの勤怠記録（日ごとの勤務時間と月合計）の確認ができます。打ち間違えた時刻は理由を添えて修正でき、修正の履歴が残ります。アカウントは管理者が発行し、権限に応じてマネージャー向けの勤怠一覧やユーザー管理を使えます。

## 権限

| 権限                    | 打刻・自分の勤怠 | 自分の勤怠の修正 | 全員の勤怠（`/manager`） | 他人の勤怠の修正 | ユーザー管理（`/admin/users`） |
| ----------------------- | :--------------: | :--------------: | :----------------------: | :--------------: | :----------------------------: |
| 一般社員（employee）    |        ○         |        ○         |                          |                  |                                |
| マネージャー（manager） |        ○         |        ○         |            ○             |        ○         |                                |
| アドミン（admin）       |        ○         |        ○         |            ○             |        ○         |               ○                |

- 権限ごとにできることは `src/domain/role.ts` の対応表1か所で定義しています。API は権限がなければ 403 `FORBIDDEN` を返し、画面はトップページへ戻します。
- 権限はリクエストごとにデータベースから読むため、変更は対象ユーザーの次の操作から反映されます（再ログイン不要）。
- アドミンが1人もいない状態にはできません。最後のアドミンの権限を変更しようとすると 409 `LAST_ADMIN` になります。
- 自分でアカウントを作る新規登録はありません。アドミンが「ユーザー管理」でログインID・表示名・初期パスワード・権限を指定して発行します。

## 操作デモ

ロールごとの操作を録画した動画です。

- [一般社員](docs/demo/employee.mp4)。ログインして出勤と退勤を打刻し、押し忘れた出勤時刻を修正して履歴を確認します。月を切り替えて勤怠も確認します。
- [マネージャー](docs/demo/manager.mp4)。全員の勤務状況の一覧を見て、メンバーの過去の退勤時刻を修正し、修正履歴に自分の名前が残ることを確認します。
- [アドミン](docs/demo/admin.mp4)。ユーザーを追加して権限を変更します。最後のアドミンを降格できないことも確認します。

`pnpm demo:record` で撮り直せます。PGlite とデモデータで本番ビルドを起動し、`tests/demo/` のシナリオを Playwright で録画します。ffmpeg があれば mp4 に変換します。

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

修正の例として、鈴木さんの直近の平日は本人が「退勤の打刻忘れ」で退勤時刻を、山田さんの2営業日前はマネージャーが「打刻時刻の誤り」で出勤時刻を修正した状態で入ります。

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

### 勤怠の修正

- 勤怠記録の各時刻には、出勤・退勤ボタンで記録した「打刻」か、手で直した「編集」かのタグが付きます。修正では値が変わった時刻だけが「編集」になり、変えなかった時刻は元のままです。
- 修正できるのは、自分の記録（全員）と他人の記録（マネージャーとアドミン）です。修正できない他人の記録は、存在しない記録と同じく 404 `RECORD_NOT_FOUND` になります。
- 鉛筆のボタンから開くダイアログで、出勤・退勤時刻（日本時間）と修正理由（必須、200文字以内）を入力します。同じダイアログに修正履歴（修正した人、日時、変更前後の時刻、理由）が新しい順に並びます。
- 修正は `attendance_record_edits` に1件ずつ追記され、アプリから更新・削除することはありません。
- 次の修正は受け付けません。退勤が出勤以前になる（409 `CLOCK_OUT_NOT_AFTER_CLOCK_IN`）、未来の時刻（400 `FUTURE_TIME`）、同じ人のほかの記録と時間が重なる（409 `OVERLAPPING_RECORD`、勤務中の記録は現在時刻まで続いているとみなします）、記録済みの退勤時刻を消す（409 `CLOCK_OUT_REQUIRED`）、どちらの時刻も変わらない（409 `NO_CHANGES`）。
- 勤務中の記録に退勤時刻を入れると、その記録は退勤済みになります（退勤の押し忘れ）。
- 勤怠記録を返す API（`/api/attendance/records` と `/api/manager/users/:id/records`）は、勤務ごとに `clockInSource`・`clockOutSource`（`clock` または `edit`）と修正回数 `editCount` を含みます。
- 修正は記録の持ち主のユーザー行と記録の行をロックする1つのトランザクションで行います。同じ人の記録への修正どうしは順番に処理されるため、重なりの判定がすり抜けることはありません（打刻ボタンはこのロックを取らないため、修正と出勤打刻が同時に起きた場合までは防いでいません）。
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
| PATCH    | `/api/attendance/records/:id`                  | 勤怠記録の修正（自分の記録、マネージャー以上は全員）     |
| GET      | `/api/attendance/records/:id/edits`            | 勤怠記録の修正履歴（修正と同じ権限）                     |
| GET      | `/api/manager/users?month=YYYY-MM`             | 全ユーザーの現在の状況と月の勤務時間（マネージャー以上） |
| GET      | `/api/manager/users/:id/records?month=YYYY-MM` | 指定ユーザーの月の勤怠記録（マネージャー以上）           |
| GET      | `/api/admin/users`                             | ユーザー一覧（アドミン）                                 |
| POST     | `/api/admin/users`                             | ユーザーを発行（アドミン）                               |
| PATCH    | `/api/admin/users/:id`                         | 権限を変更（アドミン）                                   |

## 今後の課題

- 休憩時間の記録
- チーム・部署の概念（現在はマネージャーが全員の勤怠を見られます）
- パスワードリセット（初期パスワードの変更を含む）
- ユーザーの削除・無効化
- 期限切れセッションの定期削除とログイン試行回数の制限

## ライセンス

[MIT License](LICENSE)
