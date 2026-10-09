import { describe, expect, it } from "vitest";
import { saveImage } from "./images";

describe("secure image upload", () => {
  it("rejects a disallowed MIME type", async () => {
    await expect(saveImage(new File(["hello"], "payload.svg", { type: "image/svg+xml" }))).rejects.toMatchObject({ status: 422 });
  });

  it("rejects spoofed image content", async () => {
    const bytes = new TextEncoder().encode("not a png");
    const file = { size: bytes.length, type: "image/png", arrayBuffer: async () => bytes.buffer } as File;
    await expect(saveImage(file)).rejects.toMatchObject({ status: 422 });
  });
});
