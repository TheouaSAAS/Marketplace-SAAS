import { describe, expect, it } from "vitest";
import { accuracyLevel, describeAccuracy, distanceInMeters, formatDistance, isValidLatLng } from "./geo";

describe("distanceInMeters", () => {
  it("vaut zéro pour un même point", () => {
    expect(distanceInMeters({ lat: 4.75, lng: -6.63 }, { lat: 4.75, lng: -6.63 })).toBe(0);
  });

  it("mesure environ 111,2 km pour un degré de latitude", () => {
    const d = distanceInMeters({ lat: 4, lng: -6.6 }, { lat: 5, lng: -6.6 });
    expect(d).toBeGreaterThan(111_100);
    expect(d).toBeLessThan(111_300);
  });

  it("est symétrique", () => {
    const a = { lat: 4.7485, lng: -6.6363 };
    const b = { lat: 5.36, lng: -4.0083 };
    expect(distanceInMeters(a, b)).toBeCloseTo(distanceInMeters(b, a), 6);
  });
});

describe("formatDistance", () => {
  it("affiche les mètres arrondis à la dizaine", () => {
    expect(formatDistance(853)).toBe("850 m");
    expect(formatDistance(3)).toBe("10 m");
  });

  it("affiche les kilomètres avec une virgule décimale", () => {
    expect(formatDistance(1234)).toBe("1,2 km");
    expect(formatDistance(12_600)).toBe("13 km");
  });

  it("signale une distance invalide", () => {
    expect(formatDistance(Number.NaN)).toBe("Distance inconnue");
    expect(formatDistance(-5)).toBe("Distance inconnue");
  });
});

describe("précision de la position", () => {
  it("classe la précision fournie par le navigateur", () => {
    expect(accuracyLevel(20)).toBe("precise");
    expect(accuracyLevel(400)).toBe("approximate");
    expect(accuracyLevel(3000)).toBe("coarse");
  });

  it("ne présente jamais une position imprécise comme exacte", () => {
    expect(describeAccuracy(3000)).toMatch(/peu précise/);
    expect(describeAccuracy(3000)).toMatch(/indicatives/);
  });
});

describe("isValidLatLng", () => {
  it("rejette les coordonnées absentes ou hors limites", () => {
    expect(isValidLatLng(null)).toBe(false);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 4.75, lng: -6.63 })).toBe(true);
  });
});
