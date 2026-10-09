import { describe, expect, it } from "vitest";
import { savePrivateDocument } from "./private-documents";

describe("private document storage", () => {
  it("rejects a file whose signature does not match its declared MIME type", async () => {
    const bytes = new TextEncoder().encode("not a real PDF");
    const file = { name: "identity.pdf", type: "application/pdf", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer } as File;
    await expect(savePrivateDocument(file, "test-tenant")).rejects.toMatchObject({ status: 422 });
  });
  it("rejects unsupported document types before writing", async () => {
    const file = new File(["plain text"], "identity.txt", { type: "text/plain" });
    await expect(savePrivateDocument(file, "test-tenant")).rejects.toMatchObject({ status: 422 });
  });
});
