import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { UnsubscribeForm } from "@/modules/notifications/components/unsubscribe-form";
import { readUnsubscribeToken } from "@/modules/notifications/server/unsubscribe";

export const metadata: Metadata = {
  title: "Se désabonner des e-mails",
  robots: { index: false, follow: false },
};

async function Content({ searchParams }: Pick<PageProps<"/notifications/desabonnement">, "searchParams">) {
  const token = (await searchParams).jeton;
  const target = readUnsubscribeToken(token);
  if (!target || typeof token !== "string") {
    return (
      <Alert tone="warning" title="Lien de désabonnement invalide">
        Ce lien est incomplet ou a été modifié. Vous pouvez régler tous vos e-mails depuis{" "}
        <Link href={href("dashboardNotifications")} className="underline">
          vos préférences de notification
        </Link>
        .
      </Alert>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p>
        Vous ne recevrez plus d’e-mails pour « {target.label} ». Les notifications resteront visibles sur le site, et vous pourrez
        changer d’avis à tout moment dans{" "}
        <Link href={href("dashboardNotifications")} className="underline">
          vos préférences
        </Link>
        .
      </p>
      <UnsubscribeForm token={token} label={target.label} />
    </div>
  );
}

export default function UnsubscribePage({ searchParams }: PageProps<"/notifications/desabonnement">) {
  return (
    <Container className="flex max-w-2xl flex-col gap-6 py-8 sm:py-12">
      <h1 className="text-3xl font-extrabold">Se désabonner des e-mails</h1>
      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
