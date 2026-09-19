import { getAllActiveTeachers } from "@/lib/data/landing";
import { PageHeader } from "@/components/marketing/PageHeader";
import { TeacherGrid } from "@/components/marketing/TeacherGrid";
import { FinalCTA } from "@/components/marketing/FinalCTA";

export const revalidate = 300;
export const metadata = {
  title: "Certified Yoga Teachers from India",
  description:
    "Meet our certified yoga teachers from India. Every one is Yoga Alliance trained and teaches live 1:1 sessions to students around the world.",
  alternates: { canonical: "/teachers" },
};

export default async function TeachersPage() {
  const teachers = await getAllActiveTeachers();
  return (
    <>
      <PageHeader
        eyebrow="Teachers"
        title={<>The humans on <em>the other end</em> of your mat.</>}
        subhead="Every teacher is at least 200-hr Yoga Alliance certified, with years of in-studio experience translated to live online sessions."
      />

      {teachers.length === 0 ? (
        <p className="mx-auto max-w-md px-6 pb-24 text-center text-muted-foreground">
          Our teachers are being onboarded right now, so check back soon, or book
          a 1:1 from the homepage and we&apos;ll match you.
        </p>
      ) : (
        <TeacherGrid teachers={teachers} showHeader={false} />
      )}

      <FinalCTA headline="Book a 1:1 with any teacher above." />
    </>
  );
}
