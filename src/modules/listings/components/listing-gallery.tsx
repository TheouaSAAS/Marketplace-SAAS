import Image from "next/image";
import type { ListingImage } from "../server/detail";

/** Photos publiées d'une annonce : la première en grand, les suivantes en vignettes. */
export function ListingGallery({ images, title }: { images: ListingImage[]; title: string }) {
  const [first, ...rest] = images;
  if (!first) return null;
  return (
    <section aria-label={`Photos : ${title}`} className="flex flex-col gap-2">
      <Image
        src={first.url}
        alt={first.alt || `${title} — photo 1`}
        width={first.width ?? 1200}
        height={first.height ?? 900}
        sizes="(min-width: 1024px) 50vw, 100vw"
        priority
        className="aspect-[4/3] w-full rounded-card bg-sand-100 object-cover"
      />
      {rest.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {rest.map((image, index) => (
            <li key={image.id}>
              <a href={image.url} target="_blank" rel="noopener noreferrer" className="block">
                <Image
                  src={image.url}
                  alt={image.alt || `${title} — photo ${index + 2}`}
                  width={image.width ?? 600}
                  height={image.height ?? 450}
                  sizes="(min-width: 640px) 12rem, 33vw"
                  className="aspect-square w-full rounded-control bg-sand-100 object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
