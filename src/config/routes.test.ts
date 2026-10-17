import { describe, expect, it } from "vitest";
import { href, isLive, ROUTES, type AppRoute } from "./routes";

const routes = Object.entries(ROUTES as Record<string, AppRoute>);

describe("ROUTES", () => {
  it("n'a pas deux routes sur le même chemin", () => {
    const paths = routes.map(([, route]) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("utilise des chemins en minuscules, sans accents ni barre finale", () => {
    for (const [, route] of routes) {
      expect(route.path).toMatch(/^\/([a-z0-9-]+|\[[a-z]+\])?(\/([a-z0-9-]+|\[[a-z]+\]))*$/);
    }
  });

  it("couvre les 20 pages principales du cahier des charges (§3.5)", () => {
    const required = [
      "home", "discover", "tourismGuide", "map", "listings", "realEstate", "services", "shops", "jobs", "events",
      "listingDetail", "placeDetail", "eventDetail", "publish", "login", "signup", "profile", "pro", "admin", "pricing",
      "legalNotice", "terms", "privacy",
    ];
    for (const key of required) expect(ROUTES).toHaveProperty(key);
  });

  it("garde les espaces privés hors des moteurs de recherche", () => {
    for (const key of ["login", "signup", "profile", "pro", "admin"] as const) {
      expect(ROUTES[key]).toHaveProperty("private", true);
    }
  });
});

describe("href", () => {
  it("construit un chemin simple", () => {
    expect(href("listings")).toBe("/annonces");
  });

  it("remplace les segments dynamiques en les encodant", () => {
    expect(href("listingDetail", { params: { slug: "studio cité" } })).toBe("/annonces/studio%20cit%C3%A9");
  });

  it("ignore les paramètres de requête vides et ajoute l'ancre", () => {
    expect(href("discover", { query: { categorie: "plages-sites-naturels", page: undefined, q: "" } })).toBe(
      "/decouvrir?categorie=plages-sites-naturels",
    );
    expect(href("pricing", { hash: "visibilite" })).toBe("/offres#visibilite");
  });

  it("refuse une route dynamique sans paramètre", () => {
    expect(() => href("eventDetail")).toThrow(/Paramètre manquant/);
  });
});

describe("isLive", () => {
  it("reflète le statut déclaré", () => {
    expect(isLive("home")).toBe(true);
    expect(isLive("admin")).toBe(false);
  });
});
