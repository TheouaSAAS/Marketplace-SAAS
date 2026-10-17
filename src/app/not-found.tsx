import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <Container className="py-16">
      <EmptyState
        icon={<Compass aria-hidden className="h-6 w-6" />}
        title="Cette page est introuvable"
        description="Le lien est peut-être incorrect, ou le contenu a été retiré par son auteur."
        action={<ButtonLink href="/">Retour à l’accueil</ButtonLink>}
      />
    </Container>
  );
}
