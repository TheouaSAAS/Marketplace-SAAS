import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AskState } from "../domain/ask-state";
import { NO_VERIFIED_INFO, type Passage } from "../domain/rag";
import { AssistantPanel } from "./assistant-panel";

const source: Passage = {
  chunkId: "c1",
  entityType: "guide_article",
  title: "Faire établir un acte de naissance",
  url: "/guide/demarches/acte-de-naissance",
  content: "Le service de l’état civil de la mairie délivre les copies d’actes.",
  verifiedAt: "2026-06-01T09:00:00Z",
  sourceTitle: "Mairie de San Pedro",
};

async function ask(result: AskState["result"]) {
  render(<AssistantPanel ask={async (_previous, formData) => ({ status: "done", question: String(formData.get("question")), result })} />);
  await userEvent.type(screen.getByLabelText(/Votre question/), "Où obtenir un acte de naissance ?");
  await userEvent.click(screen.getByRole("button", { name: "Demander" }));
}

describe("AssistantPanel", () => {
  it("affiche la réponse avec ses renvois numérotés, ses sources et leur date de vérification", async () => {
    await ask({ kind: "answer", segments: [{ text: "Adressez-vous à l’état civil de la mairie.", sources: [1] }], sources: [source] });
    expect(await screen.findByText("Adressez-vous à l’état civil de la mairie.")).toBeInTheDocument();
    expect(screen.getByText("[1]", { selector: "sup" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: source.title })).toHaveAttribute("href", source.url);
    expect(screen.getByText(/Vérifié le 1 juin 2026/)).toBeInTheDocument();
    expect(screen.getByText(/source : Mairie de San Pedro/)).toBeInTheDocument();
  });

  it("dit qu'il ne sait pas plutôt que d'inventer, et oriente vers la recherche", async () => {
    await ask({ kind: "no_info", sources: [] });
    expect(await screen.findByText(NO_VERIFIED_INFO)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chercher dans tout le site" }).getAttribute("href")).toMatch(/^\/recherche\?q=/);
  });

  it("sans IA, présente les passages vérifiés trouvés et la raison", async () => {
    await ask({ kind: "sources_only", sources: [source], reason: "L’assistant IA n’est pas activé sur cette plateforme." });
    expect(await screen.findByText(/n’est pas activé sur cette plateforme/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Passages vérifiés" })).toBeInTheDocument();
    expect(screen.getByText(/délivre les copies d’actes/)).toBeInTheDocument();
  });
});
