import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("services");

export default function Page({ searchParams }: PageProps<"/services">) {
  return <SectionPreview section="services" searchParams={searchParams} />;
}
