import { ClassGrid } from "@/components/marketing/ClassGrid";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { getClassCategories } from "@/lib/data/landing";

export const revalidate = 300;
export const metadata = {
  title: "Class types",
  description:
    "Diabetes, hypertension, prenatal, hormonal health, pain relief, mental health, weight loss, geriatric, kids — find the 1:1 yoga that fits what your body is working on.",
  alternates: { canonical: "/classes" },
};

export default async function ClassesPage() {
  const categories = await getClassCategories();
  return (
    <>
      <PageHeader
        eyebrow="Classes"
        title={<>Yoga for whatever your <em>body is working on</em>.</>}
      />
      <ClassGrid categories={categories} />
      <FinalCTA headline="Find the class type that fits you." />
    </>
  );
}
