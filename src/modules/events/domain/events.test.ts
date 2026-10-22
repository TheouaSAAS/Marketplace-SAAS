import { describe, expect, it } from "vitest";
import { monthGrid, monthStart, shiftMonth } from "./calendar";
import { eventIcs } from "./ics";
import { eventQuery, parseEventFilters } from "./params";

const NOW = new Date("2026-10-22T10:00:00Z"); // jeudi

describe("filtres de l'agenda", () => {
  it("forme canonique et valeurs inconnues ignorées", () => {
    const filters = parseEventFilters({ quand: "weekend", prix: "gratuit", vue: "calendrier", mois: "2026-11", categorie: "sport" });
    expect(eventQuery(filters)).toBe("quand=weekend&prix=gratuit&categorie=sport&vue=calendrier&mois=2026-11");
    expect(parseEventFilters({ quand: "hier", prix: "cher", mois: "2026-11" })).toMatchObject({ quand: null, prix: null, mois: null, vue: "liste" });
  });
});

describe("calendrier", () => {
  it("semaines complètes, lundi en premier, jours passés marqués", () => {
    const grid = monthGrid(monthStart("2026-10", NOW), NOW);
    expect(grid[0]![0]!.key).toBe("2026-09-28");
    expect(grid.at(-1)!.at(-1)!.key).toBe("2026-11-01");
    const days = grid.flat();
    expect(days.find((day) => day.key === "2026-10-22")).toMatchObject({ isToday: true, isPast: false, inMonth: true });
    expect(days.find((day) => day.key === "2026-10-21")?.isPast).toBe(true);
    expect(shiftMonth(monthStart("2026-12", NOW), 1).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("fichier d'agenda", () => {
  it("contient l'événement, son statut et des lignes repliées", () => {
    const ics = eventIcs({
      id: "abc",
      title: "Tournoi, finale; demi",
      description: "Une description assez longue pour être repliée sur plusieurs lignes dans le fichier d’agenda produit par la plateforme.",
      startsAt: new Date("2026-11-07T15:00:00Z"),
      endsAt: null,
      location: "Stade",
      url: "https://exemple.ci/evenements/tournoi",
      cancelled: true,
      now: NOW,
    });
    expect(ics).toContain("DTSTART:20261107T150000Z");
    expect(ics).toContain("DTEND:20261107T170000Z");
    expect(ics).toContain("SUMMARY:Tournoi\\, finale\\; demi");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics.split("\r\n").every((line) => line.length <= 75)).toBe(true);
  });
});
