"use client";

import Link from "next/link";
import { FileText, Heart, LogOut, MessagesSquare, UserRound } from "lucide-react";
import { href } from "@/config/routes";
import { Avatar } from "@/components/ui/avatar";
import { Popover } from "@/components/ui/popover";
import { signOutAction } from "../server/actions";

const ITEM = "flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left text-sm font-medium hover:bg-sand-100";

/** Menu du compte connecté (en-tête, ordinateur). */
export function AccountMenu({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <Popover
      align="end"
      panelClassName="w-60"
      label={
        <span className="flex items-center gap-2">
          <Avatar name={name} src={avatarUrl} size="sm" />
          <span className="max-w-28 truncate">{name}</span>
        </span>
      }
    >
      {(close) => (
        <ul className="flex flex-col">
          <li>
            <Link href={href("profile")} onClick={close} className={ITEM}>
              <UserRound aria-hidden className="h-4 w-4" /> Mon profil
            </Link>
          </li>
          <li>
            <Link href={href("messages")} onClick={close} className={ITEM}>
              <MessagesSquare aria-hidden className="h-4 w-4" /> Mes messages
            </Link>
          </li>
          <li>
            <Link href={href("favorites")} onClick={close} className={ITEM}>
              <Heart aria-hidden className="h-4 w-4" /> Mes favoris
            </Link>
          </li>
          <li>
            <Link href={href("quoteRequests")} onClick={close} className={ITEM}>
              <FileText aria-hidden className="h-4 w-4" /> Mes demandes de devis
            </Link>
          </li>
          <li className="mt-1 border-t border-border pt-1">
            <form action={signOutAction}>
              <button type="submit" className={ITEM}>
                <LogOut aria-hidden className="h-4 w-4" /> Se déconnecter
              </button>
            </form>
          </li>
        </ul>
      )}
    </Popover>
  );
}
