import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantLauncher } from "./assistant-launcher";
import { BottomNav } from "./bottom-nav";
import { Breadcrumbs } from "./breadcrumbs";
import { MainNav } from "./main-nav";
import { NavItemLink, RouteButton } from "./nav-item-link";
import { SiteFooter } from "./site-footer";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

beforeEach(() => {
  pathname.current = "/";
});

describe("NavItemLink", () => {
  it("rend un lien pour une page existante, même en préparation", () => {
    render(<NavItemLink link={{ label: "Carte", route: "map" }} />);
    expect(screen.getByRole("link", { name: "Carte" })).toHaveAttribute("href", "/carte");
  });

  it("ajoute la catégorie demandée à l'adresse", () => {
    render(<NavItemLink link={{ label: "Véhicules", route: "listings", category: "vehicules" }} />);
    expect(screen.getByRole("link", { name: "Véhicules" })).toHaveAttribute("href", "/annonces?categorie=vehicules");
  });

  it("n'offre jamais de lien vers une page absente", () => {
    render(<NavItemLink link={{ label: "Pages de ville", route: "city" }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Bientôt")).toBeInTheDocument();
  });
});

describe("RouteButton", () => {
  it("désactive l'action tant que la page n'existe pas", () => {
    render(<RouteButton route="city">Page de ville</RouteButton>);
    expect(screen.getByRole("button", { name: "Page de ville" })).toBeDisabled();
  });

  it("devient un lien quand la page existe", () => {
    render(<RouteButton route="publish">Publier</RouteButton>);
    expect(screen.getByRole("link", { name: "Publier" })).toHaveAttribute("href", "/publier");
  });
});

describe("MainNav", () => {
  it("affiche les trois rubriques et l'accès signature", async () => {
    render(<MainNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    const triggers = within(nav).getAllByRole("button");
    expect(triggers.map((button) => button.textContent)).toEqual([
      "Annonces & opportunités",
      "Découvrir & sortir",
      "Services & professionnels",
    ]);
    expect(within(nav).getByRole("link", { name: "Nouveau à San Pedro ?" })).toHaveAttribute("href", "/nouveau-arrivant");

    await userEvent.click(triggers[1]!);
    expect(screen.getByRole("link", { name: "Plages et sites naturels" })).toHaveAttribute(
      "href",
      "/tourisme?type=plages-sites-naturels",
    );
  });

  it("signale la rubrique active", () => {
    pathname.current = "/immobilier";
    render(<MainNav />);
    expect(screen.getByRole("button", { name: "Annonces & opportunités" })).toHaveClass("text-brand-700");
  });
});

describe("BottomNav", () => {
  it("propose cinq destinations et annonce la page courante", () => {
    pathname.current = "/favoris";
    render(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: "Navigation rapide" });
    expect(within(nav).getAllByRole("link")).toHaveLength(5);
    expect(within(nav).getByRole("link", { name: "Favoris" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
  });

  it("rattache la connexion à l'onglet Compte", () => {
    pathname.current = "/connexion";
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Compte" })).toHaveAttribute("aria-current", "page");
  });
});

describe("Breadcrumbs", () => {
  it("part de l'accueil et marque la page courante", () => {
    const { container } = render(<Breadcrumbs items={[{ label: "Découvrir et sortir", href: "/decouvrir" }, { label: "Tourisme" }]} />);
    const nav = screen.getByRole("navigation", { name: "Fil d’Ariane" });
    expect(within(nav).getByRole("link", { name: "Accueil" })).toHaveAttribute("href", "/");
    expect(within(nav).getByText("Tourisme")).toHaveAttribute("aria-current", "page");
    const jsonLd = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(jsonLd.itemListElement).toHaveLength(3);
  });
});

describe("AssistantLauncher", () => {
  it("annonce honnêtement l'indisponibilité de l'IA et propose des parcours existants", async () => {
    render(<AssistantLauncher enabled={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Demandez à San Pedro" }));
    expect(screen.getByText("L’assistant n’est pas encore disponible")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nouveau à San Pedro/ })).toHaveAttribute("href", "/nouveau-arrivant");
  });
});

describe("SiteFooter", () => {
  it("affiche le slogan officiel, les pages légales et la confiance", () => {
    render(<SiteFooter />);
    expect(screen.getByText("« Votre ville, mille opportunités »")).toBeInTheDocument();
    for (const label of ["Mentions légales", "Conditions d’utilisation", "Politique de confidentialité", "Signaler un contenu", "Aide"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText("Fiabilité des informations :")).toBeInTheDocument();
  });

  it("n'affiche aucun réseau social ni contact non configuré", () => {
    render(<SiteFooter />);
    expect(screen.queryByRole("list", { name: "Réseaux sociaux" })).not.toBeInTheDocument();
    expect(screen.queryByText("WhatsApp")).not.toBeInTheDocument();
  });
});
