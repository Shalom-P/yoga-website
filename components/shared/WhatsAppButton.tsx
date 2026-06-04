import { cn } from "@/lib/utils";

/**
 * Floating "chat with us" WhatsApp button, fixed bottom-right.
 *
 * The destination number comes from NEXT_PUBLIC_WHATSAPP_NUMBER (full
 * international format, e.g. 61412345678 — digits only, no "+" or spaces).
 * When the env var is unset the button renders nothing, so the site stays
 * clean until a number is configured.
 *
 * On mobile it sits above the marketing sticky CTA bar; on md+ it drops to
 * the bottom-right corner.
 */
const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
const PREFILL_MESSAGE = "Hi! I'd like to know more about your yoga classes.";

export function WhatsAppButton({ className }: { className?: string }) {
  if (!WHATSAPP_NUMBER) return null;

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILL_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={cn(
        "group fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-[#25D366] py-3 pl-3.5 pr-3.5 text-white shadow-lg shadow-black/25 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 sm:pr-4 md:bottom-6 md:right-6",
        className,
      )}
    >
      <WhatsAppGlyph className="size-6 shrink-0" />
      <span className="hidden text-sm font-semibold sm:inline">Chat with us</span>
    </a>
  );
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.001 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.257.59 4.46 1.71 6.402L3.2 28.8l6.56-1.72a12.74 12.74 0 0 0 6.24 1.59h.005c7.06 0 12.8-5.74 12.8-12.8 0-3.42-1.33-6.635-3.75-9.054A12.71 12.71 0 0 0 16.001 3.2Zm0 23.06h-.004a10.6 10.6 0 0 1-5.4-1.48l-.388-.23-4.018 1.054 1.072-3.918-.252-.402a10.58 10.58 0 0 1-1.62-5.644c0-5.866 4.774-10.64 10.642-10.64 2.842 0 5.513 1.108 7.52 3.118a10.57 10.57 0 0 1 3.118 7.526c0 5.867-4.774 10.64-10.642 10.64Zm5.834-7.97c-.32-.16-1.892-.934-2.185-1.04-.293-.107-.506-.16-.72.16-.213.32-.826 1.04-1.013 1.253-.187.213-.373.24-.693.08-.32-.16-1.35-.498-2.572-1.587-.95-.848-1.592-1.895-1.779-2.215-.186-.32-.02-.493.14-.652.144-.143.32-.373.48-.56.16-.187.213-.32.32-.533.107-.213.053-.4-.027-.56-.08-.16-.72-1.734-.986-2.374-.26-.624-.524-.54-.72-.55l-.613-.01c-.213 0-.56.08-.853.4-.293.32-1.12 1.094-1.12 2.667 0 1.573 1.146 3.093 1.306 3.307.16.213 2.253 3.44 5.46 4.826.763.33 1.358.527 1.822.674.766.244 1.463.21 2.014.127.614-.092 1.892-.773 2.158-1.52.266-.747.266-1.387.187-1.52-.08-.133-.293-.213-.613-.373Z" />
    </svg>
  );
}
