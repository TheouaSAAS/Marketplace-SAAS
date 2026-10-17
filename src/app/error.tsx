"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/feedback";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-16">
      <ErrorState
        title="Un problème est survenu"
        description="Cette page n’a pas pu s’afficher. Vérifiez votre connexion, puis réessayez."
        action={
          <Button onClick={() => retry()} icon={<RefreshCw aria-hidden className="h-4 w-4" />}>
            Réessayer
          </Button>
        }
      />
    </Container>
  );
}
