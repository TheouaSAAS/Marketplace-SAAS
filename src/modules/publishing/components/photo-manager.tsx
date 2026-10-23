"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, ScanSearch, Trash2 } from "lucide-react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { assessPhoto, PHOTO_MAX_COUNT, PHOTO_TYPES, isPhotoType } from "../domain/photos";
import { registerPhotoAction, removePhotoAction, updatePhotoAltAction } from "../server/actions";
import type { DraftPhoto } from "../server/queries";

interface PhotoItem extends DraftPhoto {
  warnings: string[];
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function duplicateWarnings(photo: { ownDuplicates: number; otherDuplicates: number }): string[] {
  const warnings: string[] = [];
  if (photo.otherDuplicates > 0) warnings.push("Photo identique déjà utilisée par un autre compte : l’équipe de modération en est informée.");
  else if (photo.ownDuplicates > 0) warnings.push("Photo déjà utilisée dans une autre de vos annonces.");
  return warnings;
}

/**
 * Photos d'une annonce : contrôles avant envoi (format, poids, résolution,
 * doublon), dépôt dans le stockage PRIVÉ, puis enregistrement. Elles ne
 * deviennent publiques qu'à la publication par l'équipe de modération.
 */
export function PhotoManager({
  listingId,
  userId,
  initial,
  aiAvailable,
  onAnalyze,
  onCountChange,
}: {
  listingId: string;
  userId: string;
  initial: DraftPhoto[];
  aiAvailable: boolean;
  onAnalyze: (photoId: string) => void;
  onCountChange: (count: number) => void;
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>(() => initial.map((photo) => ({ ...photo, warnings: duplicateWarnings(photo) })));
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const update = (next: PhotoItem[]) => {
    setPhotos(next);
    onCountChange(next.length);
  };

  function add(files: FileList | null) {
    if (!files?.length) return;
    startTransition(async () => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) {
        setMessages(["Envoi de photos indisponible."]);
        return;
      }
      const problems: string[] = [];
      let current = photos;
      for (const file of Array.from(files)) {
        if (current.length >= PHOTO_MAX_COUNT) {
          problems.push(`${PHOTO_MAX_COUNT} photos au plus.`);
          break;
        }
        let width = 0;
        let height = 0;
        try {
          const bitmap = await createImageBitmap(file);
          width = bitmap.width;
          height = bitmap.height;
          bitmap.close();
        } catch {
          problems.push(`${file.name} : image illisible.`);
          continue;
        }
        const assessment = assessPhoto({ type: file.type, bytes: file.size, width, height });
        if (assessment.errors.length || !isPhotoType(file.type)) {
          problems.push(`${file.name} : ${assessment.errors.join(" ")}`);
          continue;
        }
        const hash = await sha256(await file.arrayBuffer());
        if (current.some((photo) => photo.hash === hash)) {
          problems.push(`${file.name} : déjà ajoutée à cette annonce.`);
          continue;
        }
        const path = `${userId}/annonces/${listingId}/${crypto.randomUUID()}.${PHOTO_TYPES[file.type]}`;
        const upload = await supabase.storage.from("private-media").upload(path, file, { contentType: file.type, upsert: false });
        if (upload.error) {
          problems.push(`${file.name} : envoi impossible.`);
          continue;
        }
        const result = await registerPhotoAction({ id: listingId, path, type: file.type, bytes: file.size, width, height, hash });
        if (!result.ok) {
          problems.push(`${file.name} : ${result.message}`);
          continue;
        }
        current = [
          ...current,
          {
            id: result.photoId,
            url: URL.createObjectURL(file),
            alt: "",
            width,
            height,
            hash,
            ownDuplicates: result.ownDuplicates,
            otherDuplicates: result.otherDuplicates,
            warnings: [...assessment.warnings, ...duplicateWarnings(result)],
          },
        ];
        update(current);
      }
      setMessages(problems);
      if (input.current) input.current.value = "";
    });
  }

  function remove(photoId: string) {
    startTransition(async () => {
      const result = await removePhotoAction({ photoId });
      if (result.ok) update(photos.filter((photo) => photo.id !== photoId));
      else setMessages([result.message ?? "La photo n’a pas pu être retirée."]);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Jusqu’à {PHOTO_MAX_COUNT} photos JPEG, PNG ou WebP de 5 Mo au plus. Vos propres photos uniquement. Elles restent privées jusqu’à la publication.
      </p>
      {messages.length > 0 && (
        <Alert tone="warning">
          <ul className="list-disc pl-4">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      )}
      {photos.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Photos de l’annonce">
          {photos.map((photo, index) => (
            <li key={photo.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-2">
              {photo.url ? (
                // Adresse signée ou locale : pas d'optimisation d'image côté serveur.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt={photo.alt || `Photo ${index + 1}`} className="aspect-[4/3] w-full rounded-control object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-control bg-sand-100 text-xs text-ink-muted">Aperçu indisponible</div>
              )}
              {photo.warnings.map((warning) => (
                <p key={warning} className="text-xs text-warning">
                  {warning}
                </p>
              ))}
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Légende (facultative)
                <input
                  defaultValue={photo.alt}
                  maxLength={200}
                  onBlur={(event) => void updatePhotoAltAction({ photoId: photo.id, alt: event.target.value })}
                  className="min-h-9 rounded-control border border-border-strong px-2 text-sm font-normal"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {aiAvailable && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => onAnalyze(photo.id)} icon={<ScanSearch aria-hidden className="h-4 w-4" />}>
                    Analyser
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(photo.id)} disabled={busy} icon={<Trash2 aria-hidden className="h-4 w-4" />}>
                  Retirer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-control border border-dashed border-border-strong px-4 py-3 text-sm font-semibold hover:bg-sand-100">
        <ImagePlus aria-hidden className="h-5 w-5" />
        {busy ? "Envoi en cours…" : "Ajouter des photos"}
        <input ref={input} type="file" accept={Object.keys(PHOTO_TYPES).join(",")} multiple className="sr-only" disabled={busy || photos.length >= PHOTO_MAX_COUNT} onChange={(event) => add(event.target.files)} />
      </label>
    </div>
  );
}
