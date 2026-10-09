import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges Tailwind conflicts deterministically", () => {
    expect(cn("px-2 text-white", false, "px-4")).toBe("text-white px-4");
  });
});
