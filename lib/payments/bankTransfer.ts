/**
 * Manual SWIFT / bank-transfer account details for UAE (AED) customers.
 *
 * This is a TEMPORARY payment rail surfaced in the BankTransferDialog while
 * Razorpay International (AED card payments) is being enabled. The account is a
 * receiving account, not a secret, so these constants are safe to ship to the
 * client. India (INR) does not use this — it stays on Razorpay Checkout.
 *
 * Keep this file free of `server-only` so the client dialog can import it.
 */
export type BankTransferField = {
  label: string;
  value: string;
  /** Whether to show a copy button next to the value. */
  copyable?: boolean;
};

export const BANK_TRANSFER_FIELDS: readonly BankTransferField[] = [
  { label: "Account holder name", value: "POSHITH SUCHENDRA", copyable: true },
  { label: "Payment method", value: "SWIFT" },
  { label: "Account number / IBAN", value: "GB75TCCL04143430624250", copyable: true },
  { label: "Routing code (BIC/SWIFT)", value: "TCCLGB3L", copyable: true },
  { label: "Routing type", value: "bic_swift" },
  { label: "Bank name", value: "The Currency Cloud Limited", copyable: true },
  {
    label: "Bank address",
    value: "1 Sheldon Square, London, W2 6TT, United Kingdom",
    copyable: true,
  },
] as const;

/** Currency UAE customers are billed in for the manual transfer. */
export const BANK_TRANSFER_CURRENCY = "AED";
