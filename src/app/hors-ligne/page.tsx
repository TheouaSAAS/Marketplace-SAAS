import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/feedback";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = {
  title: "Hors ligne",
  robots: { index: false, follow: false },
};

/**
 * Page affichée par le service worker quand une navigation échoue faute de
 * réseau. Entièrement statique : mise en cache à l'installation.
 */
export default function OfflinePage() {
  return (
    <Container className="py-16">
      <ErrorState
        offline
        title="Vous êtes hors ligne"
        description="Cette page n’a pas pu être chargée : vérifiez votre connexion mobile ou Wi-Fi, puis réessayez."
        action={<RetryButton />}
      />
    </Container>
  );
}
