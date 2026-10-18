import { describe, expect, it } from "vitest";
import { hasPage, href, isLive, ROUTES, type AppRoute } from "./routes";

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

  it("couvre les pages principales des deux cahiers des charges", () => {
    const required = [
      "home", "discover", "tourism", "guide", "neighborhoods", "map", "listings", "realEstate", "services", "shops", "jobs",
      "events", "directory", "newcomer", "search", "listingDetail", "placeDetail", "eventDetail", "publish", "login", "signup",
      "profile", "favorites", "pro", "admin", "pricing", "help", "report", "verificationPolicy", "contact", "legalNotice",
      "terms", "privacy", "maintenance", "offline",
    ];
    for (const key of required) expect(ROUTES).toHaveProperty(key);
  });

  it("garde les espaces personnels et techniques hors des moteurs de recherche", () => {
    for (const key of ["login", "signup", "profile", "favorites", "pro", "admin", "maintenance", "offline", "internalStatus"] as const) {
      expect(ROUTES[key]).toHaveProperty("private", true);
    }
  });

  it("n'expose aucune route dynamique tant que sa page n'existe pas", () => {
    for (const [, route] of routes) {
      if (route.path.includes("[")) expect(route.status).not.toBe("preview");
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
    expect(href("tourism", { query: { categorie: "plages-sites-naturels", page: undefined, q: "" } })).toBe(
      "/tourisme?categorie=plages-sites-naturels",
    );
    expect(href("pricing", { hash: "visibilite" })).toBe("/offres#visibilite");
  });

  it("refuse une route dynamique sans paramètre", () => {
    expect(() => href("eventDetail")).toThrow(/Paramètre manquant/);
  });
});

describe("statuts", () => {
  it("distingue page terminée, page en préparation et page absente", () => {
    expect(isLive("home")).toBe(true);
    expect(hasPage("home")).toBe(true);
    expect(isLive("listings")).toBe(false);
    expect(hasPage("listings")).toBe(true);
    expect(hasPage("admin")).toBe(false);
  });
});
