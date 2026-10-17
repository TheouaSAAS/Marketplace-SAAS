import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Avatar, initials } from "./avatar";
import { Checkbox, Switch } from "./choice-controls";
import { ActiveFilter, FilterChip } from "./filter-chip";
import { Tabs } from "./tabs";
import { FreshnessNote, ToConfirm, VerificationBadge } from "./verification";

describe("badges de vérification", () => {
  it("distingue vérifié, à vérifier et exemple par le libellé (pas seulement la couleur)", () => {
    render(
      <>
        <VerificationBadge status="verified" />
        <VerificationBadge status="pending_validation" />
        <VerificationBadge status="placeholder" />
      </>,
    );
    expect(screen.getByText("Vérifié")).toBeInTheDocument();
    expect(screen.getByText("À vérifier")).toBeInTheDocument();
    expect(screen.getByText("Exemple · à valider localement")).toBeInTheDocument();
  });

  it("affiche la date et la source d'une donnée vérifiée", () => {
    render(<FreshnessNote status="verified" verifiedAt="2026-10-12T10:00:00Z" source="Mairie de San Pedro" />);
    expect(screen.getByText(/Vérifié le 12 octobre 2026 · Source : Mairie de San Pedro/)).toBeInTheDocument();
  });

  it("n'affirme rien pour une donnée non vérifiée", () => {
    render(<FreshnessNote status="pending_validation" />);
    expect(screen.getByText("Information à confirmer localement.")).toBeInTheDocument();
    expect(screen.queryByText(/Vérifié le/)).not.toBeInTheDocument();
  });

  it("propose un remplaçant honnête pour une valeur manquante", () => {
    render(<ToConfirm />);
    expect(screen.getByText("Information à confirmer localement")).toBeInTheDocument();
  });
});

describe("Tabs", () => {
  const items = [
    { id: "annonces", label: "Annonces", count: 3, content: <p>Liste des annonces</p> },
    { id: "lieux", label: "Lieux", content: <p>Liste des lieux</p> },
    { id: "evenements", label: "Événements", content: <p>Liste des événements</p> },
  ];

  it("se pilote au clavier (flèches, Début, Fin)", async () => {
    const onChange = vi.fn();
    render(<Tabs label="Type de résultat" items={items} onChange={onChange} />);
    const first = screen.getByRole("tab", { name: /Annonces/ });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Liste des annonces");

    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Lieux" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Lieux" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Liste des événements");
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Annonces/ })).toHaveAttribute("aria-selected", "true");
    expect(onChange).toHaveBeenLastCalledWith("annonces");
  });

  it("n'expose qu'un seul onglet dans l'ordre de tabulation", () => {
    render(<Tabs label="Type" items={items} />);
    const tabbable = screen.getAllByRole("tab").filter((tab) => tab.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });
});

describe("filtres", () => {
  it("expose l'état sélectionné d'une pastille", async () => {
    const onClick = vi.fn();
    render(
      <FilterChip selected onClick={onClick}>
        Gratuit
      </FilterChip>,
    );
    const chip = screen.getByRole("button", { name: "Gratuit" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalled();
  });

  it("permet de retirer un filtre actif", async () => {
    const onRemove = vi.fn();
    render(<ActiveFilter onRemove={onRemove}>Quartier : Cité</ActiveFilter>);
    await userEvent.click(screen.getByRole("button", { name: "Retirer le filtre Quartier : Cité" }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("cases, interrupteurs", () => {
  it("sont des contrôles natifs étiquetés", async () => {
    render(
      <>
        <Checkbox label="Meublé" />
        <Switch label="Recevoir les alertes" />
      </>,
    );
    await userEvent.click(screen.getByText("Meublé"));
    expect(screen.getByRole("checkbox", { name: "Meublé" })).toBeChecked();
    await userEvent.click(screen.getByText("Recevoir les alertes"));
    expect(screen.getByRole("switch", { name: "Recevoir les alertes" })).toBeChecked();
  });
});

describe("Avatar", () => {
  it("calcule des initiales lisibles", () => {
    expect(initials("Awa Koné")).toBe("AK");
    expect(initials("Jean Marc Yao")).toBe("JY");
    expect(initials("Boutique")).toBe("BO");
    expect(initials("  ")).toBe("?");
  });

  it("garde une alternative textuelle sans image", () => {
    render(<Avatar name="Awa Koné" />);
    expect(screen.getByRole("img", { name: "Awa Koné" })).toHaveTextContent("AK");
  });
});
