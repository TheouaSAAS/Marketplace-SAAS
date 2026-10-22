/**
 * Markdown restreint des articles du guide, lu en arbre puis rendu en React :
 * jamais de HTML brut. Pris en charge :
 *   ## Titre, ### Sous-titre (sommaire), paragraphes, listes « - » et « 1. »,
 *   encadré « > » (avertissement), **gras**, *italique* ou _italique_,
 *   [lien](/chemin-interne) ou [lien](https://…). Tout le reste est du texte.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "link"; href: string; external: boolean; children: Inline[] };

export type Block =
  | { kind: "heading"; level: 2 | 3; id: string; text: string }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "notice"; content: Inline[] };

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Identifiant d'ancre stable : « Se soigner la nuit » → « se-soigner-la-nuit ». */
export function anchorId(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section"
  );
}

/** Seuls les chemins internes et les adresses https sont des liens ; le reste reste du texte. */
export function safeHref(url: string): { href: string; external: boolean } | null {
  const value = url.trim();
  if (/^\/(?!\/)[^\s]*$/.test(value)) return { href: value, external: false };
  if (/^https:\/\/[^\s/]+\.[^\s]+$/.test(value)) return { href: value, external: true };
  return null;
}

const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|\[([^\]]+)\]\(([^)\s]+)\)/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      out.push({ kind: "text", text: rest });
      break;
    }
    if (match.index > 0) out.push({ kind: "text", text: rest.slice(0, match.index) });
    const [whole, strong, em1, em2, label, url] = match;
    if (strong !== undefined) out.push({ kind: "strong", children: parseInline(strong) });
    else if (em1 !== undefined || em2 !== undefined) out.push({ kind: "em", children: parseInline((em1 ?? em2)!) });
    else {
      const link = safeHref(url!);
      out.push(link ? { kind: "link", ...link, children: parseInline(label!) } : { kind: "text", text: whole });
    }
    rest = rest.slice(match.index + whole.length);
  }
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const ids = new Map<string, number>();
  const uniqueId = (text: string) => {
    const base = anchorId(text);
    const count = ids.get(base) ?? 0;
    ids.set(base, count + 1);
    return count ? `${base}-${count + 1}` : base;
  };
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let notice: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) });
    if (list) blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    if (notice.length) blocks.push({ kind: "notice", content: parseInline(notice.join(" ")) });
    paragraph = [];
    list = null;
    notice = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      const text = heading[2]!.replace(/#+$/, "").trim();
      blocks.push({ kind: "heading", level: heading[1]!.length as 2 | 3, id: uniqueId(text), text });
    } else if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (paragraph.length || notice.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
    } else if (quote) {
      if (paragraph.length || list) flush();
      notice.push(quote[1]!);
    } else if (list && /^\s{2,}/.test(raw)) {
      // Suite d'un élément de liste (ligne indentée).
      list.items[list.items.length - 1] += ` ${line}`;
    } else {
      if (list || notice.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

export function tableOfContents(blocks: readonly Block[]): TocEntry[] {
  return blocks.flatMap((block) => (block.kind === "heading" ? [{ id: block.id, text: block.text, level: block.level }] : []));
}

/** Temps de lecture indicatif (200 mots par minute), au moins une minute. */
export function readingMinutes(source: string): number {
  return Math.max(1, Math.round(source.split(/\s+/).filter(Boolean).length / 200));
}
