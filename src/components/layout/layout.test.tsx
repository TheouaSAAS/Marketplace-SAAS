import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MainNav } from "./main-nav";
import { NavItemLink, RouteButton } from "./nav-item-link";
import { SiteFooter } from "./site-footer";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("NavItemLink", () => {
  it("rend un lien pour une page disponible", () => {
    render(<NavItemLink link={{ label: "Accueil", route: "home" }} />);
    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute("href", "/");
  });

  it("n'offre jamais de lien vers une page non livrée", () => {
    render(<NavItemLink link={{ label: "Carte", route: "map" }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Carte").parentElement).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Bientôt")).toBeInTheDocument();
  });
});

describe("RouteButton", () => {
  it("désactive l'action tant que la page n'existe pas", () => {
    render(<RouteButton route="publish">Publier</RouteButton>);
    expect(screen.getByRole("button", { name: "Publier" })).toBeDisabled();
  });

  it("devient un lien quand la page est disponible", () => {
    render(<RouteButton route="home">Accueil</RouteButton>);
    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute("href", "/");
  });
});

describe("MainNav", () => {
  it("affiche les trois familles et leurs entrées", async () => {
    render(<MainNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    const triggers = within(nav).getAllByRole("button");
    expect(triggers.map((button) => button.textContent)).toEqual(["Découvrir", "Trouver", "Entreprendre"]);

    await userEvent.click(triggers[0]);
    expect(screen.getByText("Nouveau à San Pedro ?")).toBeInTheDocument();
    expect(screen.getByText("Plages et sites naturels")).toBeInTheDocument();
  });
});

describe("SiteFooter", () => {
  it("affiche le slogan officiel exact et les pages légales", () => {
    render(<SiteFooter />);
    expect(screen.getByText("« Votre ville, mille opportunités »")).toBeInTheDocument();
    for (const label of ["Mentions légales", "Conditions d’utilisation", "Politique de confidentialité"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("n'affiche aucun réseau social ni contact non configuré", () => {
    render(<SiteFooter />);
    expect(screen.queryByRole("list", { name: "Réseaux sociaux" })).not.toBeInTheDocument();
    expect(screen.queryByText("WhatsApp")).not.toBeInTheDocument();
  });
});
