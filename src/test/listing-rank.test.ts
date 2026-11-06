import { describe, it, expect } from "vitest";
import { fitScore, rankListings } from "@/lib/cosign/listing";
const H = { id: "h", severity: "HIGH" as const, label: "", detail: "" };
const M = { id: "m", severity: "MEDIUM" as const, label: "", detail: "" };
describe("listing ranking", () => {
  it("scores by severity", () => { expect(fitScore([])).toBe(100); expect(fitScore([H, M])).toBe(45); expect(fitScore([H, H, H])).toBe(0); });
  it("ranks fewer risks first, cheaper on ties", () => {
    const r = rankListings([{ n: "a", flags: [H], total_minor: 100 }, { n: "b", flags: [], total_minor: 900 }, { n: "c", flags: [], total_minor: 500 }]);
    expect(r.map((x) => x.n)).toEqual(["c", "b", "a"]);
    expect(r[0]?.rank).toBe(1);
  });
});
