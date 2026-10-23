"use client";

import { useActionState, useState } from "react";
import { Copy } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Select } from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { ORGANIZATION_KINDS, ROLE_RANK, TEAM_ROLES, type TeamRole } from "../domain/pro";
import { createTeamAction, inviteAction, revokeInvitationAction, updateMemberAction, type InviteState } from "../server/pro-actions";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });

export interface TeamMember {
  member_id: string;
  user_id: string;
  display_name: string;
  role: TeamRole;
}
export interface TeamInvitation {
  id: string;
  role: TeamRole;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export function CreateTeamForm({ pageId }: { pageId: string }) {
  const [state, action] = useActionState(createTeamAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="page" value={pageId} />
      <FormStatus state={state} />
      <Field label="Type d’organisation">
        {(props) => (
          <Select {...props} name="type" defaultValue="artisan">
            {Object.entries(ORGANIZATION_KINDS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <SubmitButton variant="secondary" fullWidth={false}>
        Créer l’équipe
      </SubmitButton>
    </form>
  );
}

function MemberRow({ pageId, member, canManage, isOwner, me }: { pageId: string; member: TeamMember; canManage: boolean; isOwner: boolean; me: string }) {
  const [state, action] = useActionState(updateMemberAction, INITIAL_FORM_STATE);
  const editable = canManage && (isOwner || member.role !== "owner");
  return (
    <li className="flex flex-col gap-2 rounded-control border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">
          {member.display_name}
          {member.user_id === me && <span className="ml-1 text-xs font-normal text-ink-muted">(vous)</span>}
        </p>
        <p className="text-xs text-ink-muted">{TEAM_ROLES[member.role].label}</p>
      </div>
      {editable && (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="page" value={pageId} />
          <input type="hidden" name="membre" value={member.member_id} />
          <label className="sr-only" htmlFor={`role-${member.member_id}`}>
            Rôle de {member.display_name}
          </label>
          <select id={`role-${member.member_id}`} name="role" defaultValue={member.role} className="min-h-9 rounded-control border border-border-strong bg-surface px-2 text-sm">
            {(Object.keys(TEAM_ROLES) as TeamRole[])
              .filter((role) => isOwner || role !== "owner")
              .map((role) => (
                <option key={role} value={role}>
                  {TEAM_ROLES[role].label}
                </option>
              ))}
            <option value="retirer">Retirer de l’équipe</option>
          </select>
          <SubmitButton variant="secondary" fullWidth={false}>
            Appliquer
          </SubmitButton>
          <FormStatus state={state} />
        </form>
      )}
    </li>
  );
}

function InviteForm({ pageId, organizationId }: { pageId: string; organizationId: string }) {
  const [state, action] = useActionState<InviteState, FormData>(inviteAction, INITIAL_FORM_STATE);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="page" value={pageId} />
      <input type="hidden" name="equipe" value={organizationId} />
      <Field label="Rôle de la personne invitée">
        {(props) => (
          <Select {...props} name="role" defaultValue="editor">
            {(["admin", "editor", "viewer"] as const).map((role) => (
              <option key={role} value={role}>
                {TEAM_ROLES[role].label} — {TEAM_ROLES[role].rights}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <SubmitButton variant="secondary" fullWidth={false}>
        Créer un lien d’invitation
      </SubmitButton>
      {state.status === "error" && <FormStatus state={state} />}
      {state.link && (
        <Alert tone="success" title="Lien d’invitation (usage unique, 7 jours)">
          <p className="mb-2">{state.message}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={state.link} aria-label="Lien d’invitation" className="min-h-9 min-w-0 flex-1 rounded-control border border-border-strong bg-surface px-2 text-xs" onFocus={(event) => event.target.select()} />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<Copy aria-hidden className="h-4 w-4" />}
              onClick={() => void navigator.clipboard?.writeText(state.link!).then(() => setCopied(true))}
            >
              {copied ? "Copié" : "Copier"}
            </Button>
          </div>
        </Alert>
      )}
    </form>
  );
}

function RevokeButton({ pageId, invitationId }: { pageId: string; invitationId: string }) {
  const [state, action] = useActionState(revokeInvitationAction, INITIAL_FORM_STATE);
  return (
    <form action={action}>
      <input type="hidden" name="page" value={pageId} />
      <input type="hidden" name="invitation" value={invitationId} />
      {state.status === "error" ? <FormStatus state={state} /> : <SubmitButton variant="ghost" fullWidth={false}>Révoquer</SubmitButton>}
    </form>
  );
}

/** Équipe de la page : rôles, invitations par lien, révocation (selon les droits de chacun). */
export function TeamPanel({
  pageId,
  organizationId,
  members,
  invitations,
  myRole,
  me,
  now,
}: {
  pageId: string;
  organizationId: string;
  members: TeamMember[];
  invitations: TeamInvitation[];
  myRole: TeamRole;
  me: string;
  now: string;
}) {
  const canManage = ROLE_RANK[myRole] >= ROLE_RANK.admin;
  const pending = invitations.filter((item) => !item.accepted_at && !item.revoked_at && item.expires_at > now);
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2" aria-label="Membres de l’équipe">
        {members.map((member) => (
          <MemberRow key={member.member_id} pageId={pageId} member={member} canManage={canManage} isOwner={myRole === "owner"} me={me} />
        ))}
      </ul>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Que peut faire chaque rôle ?</summary>
        <dl className="mt-2 grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
          {Object.values(TEAM_ROLES).map((role) => (
            <div key={role.label} className="contents">
              <dt className="font-semibold">{role.label}</dt>
              <dd className="text-ink-muted">{role.rights}</dd>
            </div>
          ))}
        </dl>
      </details>
      {canManage && (
        <>
          <InviteForm pageId={pageId} organizationId={organizationId} />
          {pending.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Invitations en attente</p>
              <ul className="flex flex-col gap-1 text-sm">
                {pending.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {TEAM_ROLES[invitation.role].label} · expire le {DATE.format(new Date(invitation.expires_at))}
                    </span>
                    <RevokeButton pageId={pageId} invitationId={invitation.id} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
