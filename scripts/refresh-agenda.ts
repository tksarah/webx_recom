import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseAgendaHtml } from "../src/lib/agenda-parser";
import { WEBX_AGENDA_URL } from "../src/lib/constants";

async function main() {
  const response = await fetch(WEBX_AGENDA_URL, {
    headers: {
      "User-Agent": "webx-2026-session-recommender/0.1",
      "Accept-Language": "ja,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch agenda: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const agenda = parseAgendaHtml(html);

  if (agenda.sessions.length < 10) {
    throw new Error(`Agenda parse produced too few sessions: ${agenda.sessions.length}`);
  }

  const outputDirectory = path.join(process.cwd(), "data");
  const outputPath = path.join(outputDirectory, "agenda.json");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(agenda, null, 2)}\n`, "utf8");

  console.log(`Wrote ${agenda.sessions.length} sessions to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
