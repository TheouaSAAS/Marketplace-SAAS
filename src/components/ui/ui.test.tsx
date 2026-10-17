import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Badge, SponsoredBadge, StatusBadge } from "./badge";
import { Button } from "./button";
import { EmptyState, ErrorState } from "./feedback";
import { Field, Input } from "./form-controls";
import { Modal } from "./modal";
import { Popover } from "./popover";
import { ToastProvider, useToast } from "./toast";

describe("Button", () => {
  it("déclenche l'action au clic", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Publier</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Publier" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("est bloqué et signalé pendant le chargement", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Envoyer
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Envoyer/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Traitement en cours")).toBeInTheDocument();
  });

  it("n'envoie pas un formulaire par défaut", () => {
    render(<Button>Annuler</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("Badges", () => {
  it("affiche le libellé français de chaque statut", () => {
    render(
      <>
        <StatusBadge status="pending" />
        <StatusBadge status="published" />
      </>,
    );
    expect(screen.getByText("En attente")).toBeInTheDocument();
    expect(screen.getByText("Publiée")).toBeInTheDocument();
  });

  it("identifie clairement un contenu sponsorisé", () => {
    render(<SponsoredBadge />);
    expect(screen.getByText("Sponsorisé")).toBeInTheDocument();
  });

  it("accepte un contenu libre", () => {
    render(<Badge tone="brand">Vérifié</Badge>);
    expect(screen.getByText("Vérifié")).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("relie le libellé et le message d'erreur au champ", () => {
    render(
      <Field label="Prix" error="Indiquez un montant positif.">
        {(props) => <Input {...props} />}
      </Field>,
    );
    const input = screen.getByLabelText("Prix");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Indiquez un montant positif.");
  });

  it("affiche l'aide quand il n'y a pas d'erreur", () => {
    render(
      <Field label="Titre" hint="70 caractères maximum." required>
        {(props) => <Input {...props} />}
      </Field>,
    );
    const input = screen.getByLabelText(/Titre/);
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription("70 caractères maximum.");
  });
});

describe("États vides et erreurs", () => {
  it("affiche un état vide avec son action", () => {
    render(<EmptyState title="Aucun résultat" action={<button type="button">Élargir</button>} />);
    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Élargir" })).toBeInTheDocument();
  });

  it("annonce une erreur aux technologies d'assistance", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toHaveTextContent("Le chargement a échoué");
  });
});

describe("Modal", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Ouvrir
        </button>
        <Modal open={open} onClose={() => setOpen(false)} title="Filtres">
          <p>Contenu</p>
        </Modal>
      </>
    );
  }

  it("s'ouvre et se ferme avec le bouton Fermer", async () => {
    render(<Harness />);
    const dialog = document.querySelector("dialog")!;
    expect(dialog.open).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Ouvrir" }));
    expect(dialog.open).toBe(true);
    expect(dialog).toHaveAccessibleName("Filtres");
    await userEvent.click(screen.getByRole("button", { name: "Fermer", hidden: true }));
    expect(dialog.open).toBe(false);
  });
});

describe("Popover", () => {
  it("s'ouvre, expose son état et se ferme avec Échap", async () => {
    render(<Popover label="Découvrir">{() => <a href="/x">Plages</a>}</Popover>);
    const trigger = screen.getByRole("button", { name: "Découvrir" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Plages" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("se ferme lors d'un clic à l'extérieur", async () => {
    render(
      <>
        <Popover label="Trouver">{() => <span>Panneau</span>}</Popover>
        <p>Ailleurs</p>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Trouver" }));
    expect(screen.getByText("Panneau")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Ailleurs"));
    expect(screen.queryByText("Panneau")).not.toBeInTheDocument();
  });
});

describe("Toast", () => {
  function Notifier() {
    const { notify } = useToast();
    return (
      <button type="button" onClick={() => notify({ tone: "success", title: "Annonce enregistrée" })}>
        Enregistrer
      </button>
    );
  }

  it("affiche une notification dans la région annoncée", async () => {
    render(
      <ToastProvider>
        <Notifier />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByRole("status")).toHaveTextContent("Annonce enregistrée");
  });

  it("refuse d'être utilisé hors de son fournisseur", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Notifier />)).toThrow(/ToastProvider/);
  });
});
