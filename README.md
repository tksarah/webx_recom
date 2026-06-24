# WebX 2026 Session Recommender

WebX 2026 の公式 Agenda をもとに、参加目的に合わせたおすすめセッションと会場内ルートを提示する Next.js アプリです。

## Local Development

```powershell
npm.cmd install
npm.cmd run agenda:refresh
npm.cmd run dev
```

`GEMINI_API_KEY` を `.env.local` に設定すると Gemini API を使います。未設定、または `DISABLE_GEMINI=1` の場合はローカル評価で動きます。

## Production

```bash
cp .env.example .env
docker compose up -d --build
```

`DOMAIN` と `ACME_EMAIL` を `.env` に設定すると、Caddy が HTTPS 終端と Next.js へのリバースプロキシを担当します。

## Commands

- `npm.cmd run agenda:refresh`: 公式 Agenda から `data/agenda.json` を再生成します。
- `npm.cmd run test`: 単体テストを実行します。
- `npm.cmd run build`: 本番ビルドを検証します。
- `npm.cmd run test:e2e`: E2E テストを実行します。

## Ubuntu本番環境でのAgenda手動更新

以下は本番サーバーのリポジトリ直下で実行します。

```bash
cd ~/webx_recom
```

元サイトのAgendaを取得し、運用中のWebアプリへ反映します。

```bash
bash scripts/update-agenda.sh --deploy
```

更新日時を確認します。

```bash
curl -s https://YOUR_DOMAIN/api/agenda | grep -o '"lastUpdated":"[^"]*"'
```

appコンテナの状態を確認します。

```bash
docker compose ps
```

必要に応じてログを確認します。

```bash
docker compose logs app --tail=50
```

取得だけ行い、本番画面にはまだ反映しない場合のみ以下を使います。

```bash
bash scripts/update-agenda.sh
```

反映されない場合の強制再作成です。

```bash
docker compose up -d --build --force-recreate app
```

## Privacy

匿名集計には、入力モード、選択タグ、言語、参加日、推薦セッションID、モデル応答時間だけを保存します。自由記述の本文、氏名、メール、IP、User-Agent は保存しません。
