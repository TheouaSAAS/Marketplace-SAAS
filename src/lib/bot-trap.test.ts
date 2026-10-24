import { describe, expect, it } from "vitest";
import { BOT_TRAP_FIELDS, checkBotTrap } from "./bot-trap";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const NOW = 1_800_000_000_000;

describe("défi anti-robot", () => {
  it("laisse passer un humain qui a pris le temps de remplir", () => {
    expect(checkBotTrap(form({ [BOT_TRAP_FIELDS.openedAt]: String(NOW - 8000) }), NOW)).toBe("ok");
  });

  it("repère un robot qui remplit le champ piège", () => {
    expect(checkBotTrap(form({ [BOT_TRAP_FIELDS.honeypot]: "https://spam.example", [BOT_TRAP_FIELDS.openedAt]: String(NOW - 8000) }), NOW)).toBe("robot");
  });

  it("demande de réessayer un envoi trop rapide, sans horodatage ou trop ancien", () => {
    expect(checkBotTrap(form({ [BOT_TRAP_FIELDS.openedAt]: String(NOW - 300) }), NOW)).toBe("trop_rapide");
    expect(checkBotTrap(form({}), NOW)).toBe("trop_rapide");
    expect(checkBotTrap(form({ [BOT_TRAP_FIELDS.openedAt]: String(NOW - 7 * 3600_000) }), NOW)).toBe("trop_rapide");
  });

  it("peut être assoupli pour les tests automatisés, jamais pour le champ piège", () => {
    expect(checkBotTrap(form({}), NOW, 0)).toBe("ok");
    expect(checkBotTrap(form({ [BOT_TRAP_FIELDS.honeypot]: "x" }), NOW, 0)).toBe("robot");
  });
});
