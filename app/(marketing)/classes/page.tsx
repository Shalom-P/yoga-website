import { ClassGrid } from "@/components/marketing/ClassGrid";
import { JsonLd } from "@/components/shared/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo/structuredData";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { getClassCategories } from "@/lib/data/landing";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.myyogaclasses.fit";

export const revalidate = 300;
export const metadata = {
  title: "Online 1:1 Yoga Classes by Condition",
  description:
    "Diabetes, hypertension, prenatal, hormonal health, pain relief, mental health, weight loss, geriatric, kids: find the 1:1 yoga that fits what your body is working on.",
  alternates: { canonical: "/classes" },
};

export default async function ClassesPage() {
  const categories = await getClassCategories();
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: `${SITE}/` },
          { name: "Class types", url: `${SITE}/classes` },
        ])}
      />
      <PageHeader
        eyebrow="Classes"
        title={<>Yoga for whatever your <em>body is working on</em>.</>}
      />
      <ClassGrid categories={categories} />
      <FinalCTA headline="Find the class type that fits you." />
    </>
  );
}
