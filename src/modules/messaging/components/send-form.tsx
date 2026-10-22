"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Textarea } from "@/components/ui/form-controls";
import { SubmitButton } from "@/modules/accounts/components/form-parts";
import { sendMessageAction } from "../server/actions";

/** Formulaire d'envoi d'un message ; le fil est rechargé après l'envoi. */
export function SendForm({ conversationId }: { conversationId: string }) {
  const [state, action] = useActionState(sendMessageAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="conversation" value={conversationId} />
      <label htmlFor="nouveau-message" className="sr-only">
        Votre message
      </label>
      <Textarea
        key={`${state.status}-${state.message ?? ""}`}
        id="nouveau-message"
        name="message"
        rows={3}
        maxLength={4000}
        defaultValue={state.values?.message}
        placeholder="Écrivez votre message…"
      />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
      <SubmitButton fullWidth={false}>
        <Send aria-hidden className="h-4 w-4" />
        Envoyer
      </SubmitButton>
    </form>
  );
}
