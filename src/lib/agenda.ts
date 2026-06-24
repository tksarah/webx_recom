import { readFileSync } from "node:fs";
import path from "node:path";
import { AgendaData, agendaDataSchema } from "./types";

let cachedAgenda: AgendaData | null = null;

export function getAgenda(): AgendaData {
  if (cachedAgenda) {
    return cachedAgenda;
  }

  const agendaPath = path.join(process.cwd(), "data", "agenda.json");
  const raw = readFileSync(agendaPath, "utf8");
  cachedAgenda = agendaDataSchema.parse(JSON.parse(raw));
  return cachedAgenda;
}

export function resetAgendaCacheForTests(): void {
  cachedAgenda = null;
}
