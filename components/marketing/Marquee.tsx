const STYLES = [
  "Hatha",
  "Vinyasa flow",
  "Yin",
  "Power yoga",
  "Restorative",
  "Pranayama",
  "Meditation",
  "Prenatal",
  "Beginner basics",
  "Ashtanga",
];

/**
 * Infinite-scroll ribbon of class styles. Two identical track halves so the
 * -50% translate loop is seamless. Decorative — hidden from assistive tech.
 */
export function Marquee() {
  return (
    <div className="myc-marquee myc-sec-mint py-6" aria-hidden="true">
      <div className="myc-marquee__track">
        <span>
          {STYLES.map((s) => (
            <span key={`a-${s}`}>{s}</span>
          ))}
        </span>
        <span>
          {STYLES.map((s) => (
            <span key={`b-${s}`}>{s}</span>
          ))}
        </span>
      </div>
    </div>
  );
}
