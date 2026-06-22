const CATEGORIES = [
  "Diabetes",
  "Hypertension",
  "Prenatal",
  "Hormonal",
  "Pain Relief",
  "Mental Health",
  "Weight Loss",
  "Geriatric",
  "Kids Yoga",
];

/**
 * Infinite-scroll ribbon of class categories. Two identical track halves so the
 * -50% translate loop is seamless. Decorative — hidden from assistive tech.
 */
export function Marquee() {
  return (
    <div className="myc-marquee myc-sec-mint py-6" aria-hidden="true">
      <div className="myc-marquee__track">
        <span>
          {CATEGORIES.map((c) => (
            <span key={`a-${c}`}>{c}</span>
          ))}
        </span>
        <span>
          {CATEGORIES.map((c) => (
            <span key={`b-${c}`}>{c}</span>
          ))}
        </span>
      </div>
    </div>
  );
}
