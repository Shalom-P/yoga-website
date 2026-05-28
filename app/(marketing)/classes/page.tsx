import { ClassGrid } from "@/components/marketing/ClassGrid";
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
      <section className="pt-32 pb-4 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium mb-3">
            Classes
          </div>
          <h1 className="text-4xl md:text-6xl font-[family-name:var(--font-heading)] tracking-tight text-balance">
            Six paths to a calmer, stronger you.
          </h1>
        </div>
      </section>
      <ClassGrid categories={categories} />
      <FinalCTA headline="Try any class type — first one free." />
    </>
  );
}
