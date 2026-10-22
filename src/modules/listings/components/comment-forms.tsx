"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { addCommentAction, setCommentStatusAction } from "../server/comment-actions";

/** Nouveau commentaire, ou réponse de l'annonceur si `parentId` est fourni. */
export function CommentForm({ listingId, back, parentId }: { listingId: string; back: string; parentId?: string }) {
  const [state, action] = useActionState(addCommentAction, INITIAL_FORM_STATE);
  const label = parentId ? "Votre réponse" : "Poser une question publique";
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="annonce" value={listingId} />
      <input type="hidden" name="retour" value={back} />
      {parentId && <input type="hidden" name="parent" value={parentId} />}
      <FormStatus state={state} />
      <Field
        label={label}
        error={state.fieldErrors?.texte}
        hint="Visible par tous. Pas de téléphone ni d’e-mail : pour échanger en privé, utilisez la messagerie."
      >
        {(props) => (
          // Remonté après chaque envoi : vidé après succès, saisie conservée après erreur.
          <Textarea key={`${state.status}-${state.message ?? ""}`} {...props} name="texte" rows={parentId ? 2 : 3} maxLength={1000} defaultValue={state.values?.texte} />
        )}
      </Field>
      <div>
        <SubmitButton fullWidth={false} variant="secondary">
          {parentId ? "Répondre" : "Publier le commentaire"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Supprimer son commentaire, ou (annonceur) le masquer. */
export function CommentStatusButton({
  commentId,
  status,
  label,
  back,
  confirmation,
}: {
  commentId: string;
  status: "deleted" | "hidden";
  label: string;
  back: string;
  confirmation: string;
}) {
  const [state, action, pending] = useActionState(setCommentStatusAction, INITIAL_FORM_STATE);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmation)) event.preventDefault();
      }}
    >
      <input type="hidden" name="commentaire" value={commentId} />
      <input type="hidden" name="statut" value={status} />
      <input type="hidden" name="retour" value={back} />
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        {label}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
