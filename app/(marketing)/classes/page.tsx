import { ClassGrid } from "@/components/marketing/ClassGrid";
import { PageHeader } from "@/components/marketing/PageHeader";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { getClassCategories } from "@/lib/data/landing";

export const revalidate = 300;
export const metadata = {
  title: "Class types",
  description: "Hatha, Vinyasa, Yin, Restorative, Prenatal, Therapy — find your style.",
};

export default async function ClassesPage() {
  const categories = await getClassCategories();
  return (
    <>
      <PageHeader
        eyebrow="Classes"
        title={<>Six paths to a <em>calmer, stronger</em> you.</>}
      />
      <ClassGrid categories={categories} />
      <FinalCTA headline="Try any class type — first one free." />
    </>
  );
}
