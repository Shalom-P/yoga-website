/**
 * One sentence on the languages the public roster teaches in, built from each
 * teacher's `languages` column so the copy cannot drift from the roster.
 *
 * "All our teachers teach in English. Dr Hima Bindu also teaches in Kannada
 * and Hindi." Returns null for an empty roster.
 *
 * Pure and dependency-free so it can be unit-tested.
 */
type WithLanguages = { display_name: string; languages: string[] | null };

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function rosterLanguageSentence(teachers: WithLanguages[]): string | null {
  if (teachers.length === 0) return null;
  const langs = teachers.map((t) => (t.languages ?? []).map((l) => l.trim()).filter(Boolean));

  // Languages every teacher speaks, in the first teacher's order.
  const shared = langs[0].filter((l) => langs.every((ls) => ls.includes(l)));
  const sentences: string[] = [];
  if (shared.length > 0) sentences.push(`All our teachers teach in ${list(shared)}.`);

  teachers.forEach((t, i) => {
    const extra = langs[i].filter((l) => !shared.includes(l));
    if (extra.length === 0) return;
    sentences.push(
      shared.length > 0
        ? `${t.display_name} also teaches in ${list(extra)}.`
        : `${t.display_name} teaches in ${list(extra)}.`,
    );
  });

  return sentences.length > 0 ? sentences.join(" ") : null;
}
