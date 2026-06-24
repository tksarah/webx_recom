# WebX 2026 Session Recommender

WebX 2026 の公式Agendaをもとに、参加者の関心に合うセッションと会場内ルートを提示する Next.js アプリです。

## Local Development

```powershell
npm.cmd install
npm.cmd run agenda:refresh
npm.cmd run dev
```

`GEMINI_API_KEY` を `.env.local` に設定すると Gemini API を使います。未設定または `DISABLE_GEMINI=1` の場合は、ローカルのヒューリスティック推薦で動きます。

## Production

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

`DOMAIN` と `ACME_EMAIL` を `.env` に設定すると、Caddy が HTTPS 終端と Next.js へのリバースプロキシを担当します。

## Commands

- `npm.cmd run agenda:refresh`: 公式AgendaからセッションJSONを再生成します。
- `npm.cmd run test`: Agenda解析、ルート最適化、PDF生成、匿名集計を検証します。
- `npm.cmd run build`: 本番ビルドを検証します。
- `npm.cmd run test:e2e`: GeminiをモックしたE2Eを実行します。

## Manual Agenda Update on Ubuntu

The production host does not need Node.js or npm for manual Agenda updates. It only needs bash and Docker Compose.

```bash
bash scripts/update-agenda.sh
```

Docker production reflects `data/agenda.json` from the built image. To refresh the Agenda and rebuild the app service:

```bash
bash scripts/update-agenda.sh --deploy
```

The script prints the Agenda `lastUpdated` value and session count before and after refresh.

## Privacy

匿名集計には、入力モード、選択タグ、言語、参加日、推薦セッションID、モデル応答時間だけを保存します。自由記述の本文、氏名、メール、IP、User-Agent は保存しません。
