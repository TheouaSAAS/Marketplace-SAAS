import Link from "next/link";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import type { Block, Inline, TocEntry } from "../domain/markdown";

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case "text":
        return node.text;
      case "strong":
        return <strong key={index}>{renderInline(node.children)}</strong>;
      case "em":
        return <em key={index}>{renderInline(node.children)}</em>;
      case "link":
        return node.external ? (
          <a key={index} href={node.href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-brand-700 underline">
            {renderInline(node.children)}
          </a>
        ) : (
          <Link key={index} href={node.href} className="font-medium text-brand-700 underline">
            {renderInline(node.children)}
          </Link>
        );
    }
  });
}

/** Corps d'un article : arbre du Markdown restreint rendu en éléments React (jamais de HTML brut). */
export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex max-w-prose flex-col gap-4 text-base leading-relaxed">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "heading":
            return block.level === 2 ? (
              <h2 key={index} id={block.id} className="mt-4 scroll-mt-24 text-xl font-bold">
                {block.text}
              </h2>
            ) : (
              <h3 key={index} id={block.id} className="mt-2 scroll-mt-24 text-lg font-bold">
                {block.text}
              </h3>
            );
          case "paragraph":
            return <p key={index}>{renderInline(block.content)}</p>;
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag key={index} className={`flex flex-col gap-1 pl-6 ${block.ordered ? "list-decimal" : "list-disc"}`}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </Tag>
            );
          }
          case "notice":
            return (
              <aside key={index} className="flex gap-2 rounded-card border border-border bg-warning-soft p-3 text-sm">
                <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p>{renderInline(block.content)}</p>
              </aside>
            );
        }
      })}
    </div>
  );
}

/** Sommaire de l'article (repliable). */
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  if (entries.length < 2) return null;
  return (
    <nav aria-label="Sommaire" className="rounded-card border border-border bg-surface p-4">
      <details open>
        <summary className="cursor-pointer font-semibold">Sommaire</summary>
        <ol className="mt-2 flex flex-col gap-1 text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className={entry.level === 3 ? "pl-4" : undefined}>
              <a href={`#${entry.id}`} className="inline-flex min-h-9 items-center text-brand-700 hover:underline">
                {entry.text}
              </a>
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}
