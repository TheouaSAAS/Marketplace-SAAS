import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { isFeatureEnabled } from "@/server/features";

/** Cadre commun des pages de compte : étroit, centré, lisible au pouce sur mobile. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const available = isFeatureEnabled("accounts");
  return (
    <Container className="flex justify-center py-8 sm:py-14">
      <div className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
          {description && <p className="text-ink-muted">{description}</p>}
        </header>
        <Card>
          <CardBody className="gap-5 p-5 sm:p-6">
            {available ? (
              children
            ) : (
              <Alert tone="warning" title="Comptes momentanément indisponibles">
                La consultation du site reste possible sans compte.
              </Alert>
            )}
          </CardBody>
        </Card>
        {footer && <div className="flex flex-col items-center gap-2 text-center text-sm">{footer}</div>}
      </div>
    </Container>
  );
}
