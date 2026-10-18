import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Maintenance en cours",
  robots: { index: false, follow: false },
};

/** Servie à la place de toutes les pages publiques quand FEATURE_MAINTENANCE=on (voir proxy). */
export default function MaintenancePage() {
  return (
    <Container className="py-16">
      <EmptyState
        icon={<Wrench aria-hidden className="h-6 w-6" />}
        title="Maintenance en cours"
        description="La plateforme est momentanément indisponible pour une opération de maintenance. Merci de revenir dans quelques instants."
      />
    </Container>
  );
}
