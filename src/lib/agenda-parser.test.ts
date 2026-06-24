import { describe, expect, it } from "vitest";
import { parseAgendaHtml } from "./agenda-parser";

const fixture = `
  <main>
    <h1>Agenda of WebX 2026</h1>
    <p>CRYL Stage Binance Stage C Stage Visionary Stage Seminar</p>
    <p>July 13 July 14</p>
    <div class="ag-set" id="ag1">
      <span class="ag-date"><span>7/13</span></span>
      <span class="ag-lang">EN</span>
      <span class="ag-room">Binance Stage</span>
      <div class="ag-time">11:45<span>AM</span> - 12:25<span>PM</span></div>
      <div class="ag-title">Who Owns the Agent? AI, IP, and the Future of Policy</div>
      <a class="ag-spaker">
        <div class="ag-spaker-name">Yat Siu</div>
        <div class="ag-spaker-com">Animoca Brands</div>
      </a>
    </div>
    <div class="ag-set" id="ag2">
      <span class="ag-date"><span>7/13</span></span>
      <span class="ag-lang">JA</span>
      <span class="ag-room">C Stage</span>
      <div class="ag-time">2:15<span>PM</span> - 2:55<span>PM</span></div>
      <div class="ag-title">TradFi Meets DeFi: The Next Generation of Financial Products</div>
    </div>
    <div class="ag-set" id="ag3">
      <span class="ag-date"><span>7/14</span></span>
      <span class="ag-lang"></span>
      <span class="ag-room">金融セミナー</span>
      <div class="ag-time">4:00<span>PM</span> - 4:45<span>PM</span></div>
      <div class="ag-title">TBA</div>
    </div>
    <footer>SUBSCRIBE</footer>
  </main>
`;

describe("parseAgendaHtml", () => {
  it("extracts sessions with day, language, stage and times", () => {
    const agenda = parseAgendaHtml(fixture, "2026-06-24T00:00:00.000Z");

    expect(agenda.sessions).toHaveLength(3);
    expect(agenda.sessions[0]).toMatchObject({
      date: "2026-07-13",
      language: "EN",
      stage: "Binance Stage",
      startMinutes: 705,
      endMinutes: 745,
      title: "Who Owns the Agent? AI, IP, and the Future of Policy",
    });
    expect(agenda.sessions[2]).toMatchObject({
      date: "2026-07-14",
      language: "UNKNOWN",
      stage: "Seminar",
      isPlaceholder: true,
      title: "詳細未公開",
    });
  });
});
