"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox } from "@/components/ui/choice-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { setBlockAction } from "../server/actions";

/** Bloquer ou débloquer l'interlocuteur ; le blocage demande une confirmation explicite. */
export function BlockForm({ memberId, conversationId, blocked, name }: { memberId: string; conversationId: string; blocked: boolean; name: string }) {
  const [state, action] = useActionState(setBlockAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2 rounded-card border border-border p-3 text-sm">
      <input type="hidden" name="membre" value={memberId} />
      <input type="hidden" name="conversation" value={conversationId} />
      <input type="hidden" name="bloquer" value={blocked ? "0" : "1"} />
      <FormStatus state={state} />
      {!blocked && <Checkbox name="confirmer" value="1" required label={`Je confirme : ${name} ne pourra plus m’écrire`} />}
      <div>
        <SubmitButton variant={blocked ? "secondary" : "danger"} fullWidth={false}>
          {blocked ? "Débloquer ce membre" : "Bloquer ce membre"}
        </SubmitButton>
      </div>
    </form>
  );
}
