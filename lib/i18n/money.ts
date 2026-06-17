const audFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

const audFormatterCents = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
});

export function formatAud(cents: number, opts: { withCents?: boolean } = {}) {
  const dollars = cents / 100;
  return opts.withCents ? audFormatterCents.format(dollars) : audFormatter.format(dollars);
}
