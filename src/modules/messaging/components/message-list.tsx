import { cn } from "@/lib/cn";
import type { ChatMessage } from "../server/queries";

const TIME = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Abidjan" });

/** Messages d'une conversation, du plus ancien au plus récent ; les siens à droite. */
export function MessageList({ messages, myId, otherName }: { messages: ChatMessage[]; myId: string; otherName: string }) {
  if (messages.length === 0) return <p className="text-sm text-ink-muted">Aucun message pour l’instant.</p>;
  return (
    <ol className="flex flex-col gap-3" aria-label="Messages">
      {messages.map((message) => {
        const mine = message.sender_id === myId;
        return (
          <li key={message.id} className={cn("flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
            <span className="text-xs text-ink-subtle">
              {mine ? "Vous" : otherName} · {TIME.format(new Date(message.created_at))}
            </span>
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-line break-words rounded-card px-3 py-2",
                mine ? "bg-brand-600 text-white" : "border border-border bg-surface",
              )}
            >
              {message.body}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
