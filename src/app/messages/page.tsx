import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MessagesSquare } from "lucide-react";
import { href } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { listMyConversations } from "@/modules/messaging/server/queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Mes messages",
  robots: { index: false, follow: false },
};

async function ConversationList() {
  await requireAccount(href("messages"));
  const conversations = await listMyConversations();
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<MessagesSquare aria-hidden className="h-6 w-6" />}
        title="Aucune conversation"
        description="Écrivez à un annonceur depuis une annonce : vos échanges apparaîtront ici, sans partager vos coordonnées."
        action={<ButtonLink href={href("search", { query: { type: "annonces" } })}>Parcourir les annonces</ButtonLink>}
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
      {conversations.map((conversation) => (
        <li key={conversation.conversation_id}>
          <Link
            href={href("messageThread", { params: { id: conversation.conversation_id } })}
            className="flex items-start justify-between gap-3 p-4 hover:bg-sand-50"
          >
            <div className="min-w-0">
              <p className={cn("truncate", conversation.unread > 0 ? "font-bold" : "font-semibold")}>{conversation.other_name}</p>
              {(conversation.listing_title ?? conversation.place_name ?? conversation.event_title) && (
                <p className="truncate text-sm text-brand-700">{conversation.listing_title ?? conversation.place_name ?? conversation.event_title}</p>
              )}
              {conversation.last_message && (
                <p className="truncate text-sm text-ink-muted">
                  {conversation.last_message_mine ? "Vous : " : ""}
                  {conversation.last_message}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xs text-ink-subtle">{formatDate(conversation.last_message_at, "short")}</span>
              {conversation.unread > 0 && (
                <span className="rounded-pill bg-accent-600 px-2 text-xs font-bold text-white">
                  {conversation.unread}
                  <span className="sr-only"> non lu{conversation.unread > 1 ? "s" : ""}</span>
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function MessagesPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mon profil", href: href("profile") }, { label: "Mes messages" }]} />
      <h1 className="text-3xl font-extrabold">Mes messages</h1>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <ConversationList />
      </Suspense>
    </Container>
  );
}
