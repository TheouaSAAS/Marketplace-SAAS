import {
  BedDouble,
  Bike,
  Briefcase,
  CalendarDays,
  Car,
  FileText,
  GraduationCap,
  Handshake,
  House,
  Landmark,
  MapPin,
  Package,
  Store,
  TreePalm,
  Truck,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/** Icônes des catégories (nom stocké en base → composant). Liste fermée : pas d'import dynamique. */
const ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  waves: TreePalm,
  utensils: Utensils,
  "bed-double": BedDouble,
  bike: Bike,
  "calendar-days": CalendarDays,
  house: House,
  briefcase: Briefcase,
  package: Package,
  car: Car,
  store: Store,
  wrench: Wrench,
  truck: Truck,
  "graduation-cap": GraduationCap,
  handshake: Handshake,
  "file-text": FileText,
};

/** Noms d'icônes proposés à l'administration des catégories. */
export const CATEGORY_ICON_NAMES = Object.keys(ICONS);

const TONES = {
  brand: "from-brand-50 to-brand-100 text-brand-700",
  lagoon: "from-lagoon-50 to-lagoon-100 text-lagoon-700",
  accent: "from-accent-50 to-accent-100 text-accent-700",
  sand: "from-sand-100 to-sand-200 text-sand-700",
} as const;

/**
 * Visuel d'en-tête de carte sans photo : icône de la catégorie sur un fond
 * teinté. Aucune image n'est inventée ; les vraies photos arriveront avec les fiches.
 */
export function CategoryVisual({
  icon,
  fallback = MapPin,
  tone = "brand",
  className,
}: {
  icon: string | null | undefined;
  fallback?: LucideIcon;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const Icon = (icon && ICONS[icon]) || fallback;
  return (
    <div aria-hidden="true" className={cn("flex aspect-[16/9] items-center justify-center bg-gradient-to-br", TONES[tone], className)}>
      <Icon className="h-10 w-10 opacity-80" strokeWidth={1.5} />
    </div>
  );
}
