import { describe, expect, it } from "vitest";
import { formatDistance, formatPositionCookie, parsePositionCookie, roundPosition } from "./position";

describe("position du visiteur (confidentialité)", () => {
  it("arrondit à environ 100 m avant tout stockage", () => {
    expect(roundPosition({ lat: 4.748512, lng: -6.636349 })).toEqual({ lat: 4.749, lng: -6.636 });
    expect(formatPositionCookie({ lat: 4.748512, lng: -6.636349 })).toBe("4.749,-6.636");
  });

  it("refuse un cookie forgé, trop précis ou hors limites", () => {
    expect(parsePositionCookie("4.749,-6.636")).toEqual({ lat: 4.749, lng: -6.636 });
    expect(parsePositionCookie("4.7485123,-6.6363")).toBeNull();
    expect(parsePositionCookie("95.000,10.000")).toBeNull();
    expect(parsePositionCookie("4.7,-6.6;admin=1")).toBeNull();
    expect(parsePositionCookie(undefined)).toBeNull();
  });

  it("annonce une distance arrondie, jamais en dessous de 100 m", () => {
    expect(formatDistance(30, false)).toBe("à 100 m");
    expect(formatDistance(1540, true).replace(/\s/g, " ")).toBe("à environ 1,5 km");
  });
});
