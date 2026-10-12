import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const mockEventSchema = z.object({
  eventId: z.string().min(8).max(160),
  paymentId: z.string().min(8).max(160),
  transactionId: z.string().min(8).max(160),
  status: z.enum(["PENDING", "PAID", "FAILED", "EXPIRED", "CANCELED"]),
  amountMinor: z.string().regex(/^\d+$/),
  currency: z.literal("IDR"),
  occurredAt: z.string().datetime(),
});
export type MockEvent = z.infer<typeof mockEventSchema>;

function secret() {
  const configured = process.env.PAYMENT_MOCK_WEBHOOK_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("PAYMENT_MOCK_WEBHOOK_SECRET wajib dikonfigurasi.");
  return "liga-goal-local-mock-only-phase-15";
}

export function signMockWebhook(rawBody: string) {
  return createHmac("sha256", secret()).update(rawBody).digest("hex");
}

export function verifyMockWebhook(rawBody: string, signature: string | null) {
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = Buffer.from(signMockWebhook(rawBody), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function payloadHash(rawBody: string) { return createHash("sha256").update(rawBody).digest("hex"); }
export function signatureDigest(signature: string) { return createHash("sha256").update(signature).digest("hex"); }

export const mockPaymentProvider = {
  code: "MOCK_LOCAL",
  async createPayment(input: { amountMinor: bigint; currency: "IDR"; idempotencyKey: string }) {
    if (process.env.PAYMENT_MOCK_FORCE_OUTAGE === "1") throw new Error("MOCK_PROVIDER_UNAVAILABLE");
    const externalPaymentId = `mock_pay_${randomUUID()}`;
    return { externalPaymentId, checkoutReference: `SIMULATION:${externalPaymentId}`, expiresAt: new Date(Date.now() + 30 * 60_000), status: "PENDING" as const, echoedAmountMinor: input.amountMinor, idempotencyKey: input.idempotencyKey };
  },
  async inquiry(input: { externalPaymentId: string; lastStatus?: string | null }) {
    if (process.env.PAYMENT_MOCK_FORCE_OUTAGE === "1") throw new Error("MOCK_PROVIDER_UNAVAILABLE");
    return { externalPaymentId: input.externalPaymentId, status: input.lastStatus ?? "PENDING", source: "LOCAL_LEDGER" };
  },
  async refund(input: { amountMinor: bigint; transactionId: string; idempotencyKey: string }) {
    if (process.env.PAYMENT_MOCK_FORCE_OUTAGE === "1") throw new Error("MOCK_PROVIDER_UNAVAILABLE");
    return { externalRefundId: `mock_ref_${randomUUID()}`, status: "SUCCEEDED" as const, ...input };
  },
  createEvent(input: { paymentId: string; amountMinor: bigint; status: MockEvent["status"]; eventId?: string; transactionId?: string }) {
    const event: MockEvent = { eventId: input.eventId ?? `mock_evt_${randomUUID()}`, paymentId: input.paymentId, transactionId: input.transactionId ?? `mock_tx_${randomUUID()}`, status: input.status, amountMinor: input.amountMinor.toString(), currency: "IDR", occurredAt: new Date().toISOString() };
    const rawBody = JSON.stringify(event);
    return { rawBody, signature: signMockWebhook(rawBody), event };
  },
};

export async function providerCall<T>(operation: () => Promise<T>, attempts = 3, timeoutMs = 2_000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await Promise.race([operation(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("PAYMENT_PROVIDER_TIMEOUT")), timeoutMs))]); }
    catch (error) { lastError = error; if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 20 * attempt)); }
  }
  throw lastError;
}

export type PaymentProvider = typeof mockPaymentProvider;
