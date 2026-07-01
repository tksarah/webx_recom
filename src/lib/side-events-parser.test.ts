import { describe, expect, it } from "vitest";
import {
  buildSideEventData,
  mergeParsedSideEvent,
  parseLumaCalendarEvents,
  parseSideEventDetailHtml,
  parseSideEventsCalendarHtml,
} from "./side-events-parser";

describe("side-events-parser", () => {
  it("extracts events from Luma calendar JSON-LD", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "item": {
              "@type": "Event",
              "@id": "https://luma.com/test123",
              "url": "https://luma.com/test123",
              "name": "Stablecoin Networking Night",
              "startDate": "2026-07-13T19:00:00.000+09:00",
              "endDate": "2026-07-13T21:00:00.000+09:00",
              "location": {
                "@type": "Place",
                "name": "Tokyo Hall",
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "1-2-3",
                  "addressLocality": "Minato",
                  "addressRegion": "Tokyo",
                  "addressCountry": "JP"
                },
                "geo": { "@type": "GeoCoordinates", "latitude": 35.1, "longitude": 139.1 }
              },
              "image": ["https://images.example.com/event.png"],
              "offers": [{ "@type": "Offer", "name": "General", "price": 0, "priceCurrency": "usd" }]
            }
          }
        ]
      }
      </script>
    `;

    const data = parseSideEventsCalendarHtml(html, "2026-07-01T00:00:00.000Z");
    expect(data.events).toHaveLength(1);
    expect(data.events[0]).toMatchObject({
      id: "side-event-test123",
      title: "Stablecoin Networking Night",
      date: "2026-07-13",
      startTime: "19:00",
      endTime: "21:00",
      venueName: "Tokyo Hall",
      registration: { free: true },
    });
    expect(data.events[0].tags).toContain("stablecoin");
  });

  it("merges detail JSON-LD and keeps calendar data as fallback", () => {
    const calendar = parseLumaCalendarEvents(`
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [{
          "@type": "ListItem",
          "item": {
            "@type": "Event",
            "url": "https://luma.com/detail123",
            "name": "RWA Breakfast",
            "startDate": "2026-07-14T08:30:00.000+09:00",
            "location": { "@type": "Place", "name": "Shibuya" }
          }
        }]
      }
      </script>
    `)[0];
    const detail = parseSideEventDetailHtml(`
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "url": "https://luma.com/detail123",
        "name": "RWA Breakfast",
        "startDate": "2026-07-14T08:30:00.000+09:00",
        "endDate": "2026-07-14T10:00:00.000+09:00",
        "description": "Tokenization, institutional investors, and treasury networking.",
        "organizer": [{ "@type": "Organization", "name": "Example DAO" }],
        "location": { "@type": "Place", "name": "Shibuya" }
      }
      </script>
      <body>Registration Approval Required</body>
    `);

    const data = buildSideEventData([mergeParsedSideEvent(calendar, detail)], "2026-07-01T00:00:00.000Z");
    expect(data.events[0].description).toContain("Tokenization");
    expect(data.events[0].organizers).toContain("Example DAO");
    expect(data.events[0].registration.approvalRequired).toBe(true);
    expect(data.events[0].tags).toContain("rwa");
  });
});
