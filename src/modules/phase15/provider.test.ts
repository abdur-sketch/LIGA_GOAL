import { describe, expect, it } from "vitest";
import { invoiceStateAllows } from "./service";
import { mockPaymentProvider, signMockWebhook, verifyMockWebhook } from "./provider";
describe("Phase 15 financial primitives", () => {
  it("signs and verifies exact raw webhook bytes", () => { const event = mockPaymentProvider.createEvent({ paymentId: "mock_payment_123", amountMinor: BigInt(75000000), status: "PAID" }); expect(verifyMockWebhook(event.rawBody, event.signature)).toBe(true); expect(verifyMockWebhook(`${event.rawBody} `, event.signature)).toBe(false); expect(signMockWebhook(event.rawBody)).toBe(event.signature); });
  it("allows only forward invoice state transitions", () => { expect(invoiceStateAllows("OPEN", "PAID")).toBe(true); expect(invoiceStateAllows("PAID", "OPEN")).toBe(false); expect(invoiceStateAllows("REFUNDED", "PAID")).toBe(false); });
});
