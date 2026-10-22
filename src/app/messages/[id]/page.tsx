import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MessageList } from "@/modules/messaging/components/message-list";
import { SendForm } from "@/modules/messaging/components/send-form";
import { ThreadRefresher } from "@/modules/messaging/components/thread-refresher";
import { getConversation, markConversationRead } from "@/modules/messaging/server/queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Conversation",
  robots: { index: false, follow: false },
};

type Props = PageProps<"/messages/[id]">;

async function Conversation({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const account = await requireAccount(href("messages"));
  if (!z.uuid().safeParse(id).success) notFound();
  const conversation = await getConversation(id);
  // Introuvable ou conversation d'autres personnes : même réponse.
  if (!conversation) notFound();
  const { header, messages } = conversation;
  await markConversationRead(id, account.id);

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: "Mes messages", href: href("messages") }, { label: header.other_name }]} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">{header.other_name}</h1>
        {header.listing_title && header.listing_slug && (
          <p className="text-sm">
            À propos de{" "}
            <Link href={href("listingDetail", { params: { slug: header.listing_slug } })} className="font-semibold text-brand-700 hover:underline">
              {header.listing_title}
            </Link>
          </p>
        )}
      </div>
      {header.listing_id && !header.listing_active && (
        <Alert tone="warning">Cette annonce n’est plus disponible. Vous pouvez encore échanger avec l’annonceur.</Alert>
      )}
      <MessageList messages={messages} myId={account.id} otherName={header.other_name} />
      <SendForm conversationId={id} />
      <ThreadRefresher />
      <p className="text-xs text-ink-muted">
        Ne communiquez jamais un code reçu par SMS et ne payez rien d’avance. En cas d’abus, signalez l’annonce depuis sa page.
      </p>
    </div>
  );
}

export default function ConversationPage({ params }: Props) {
  return (
    <Container className="flex max-w-3xl flex-col py-8 sm:py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Conversation params={params} />
      </Suspense>
    </Container>
  );
}
