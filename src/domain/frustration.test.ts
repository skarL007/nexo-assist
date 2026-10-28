import { describe, expect, it } from "vitest";
import { shouldOfferAnalyst } from "./frustration";

describe("oferecer analista por frustração", () => {
  it("frustração alta oferece já no primeiro turno", () => {
    expect(shouldOfferAnalyst({ frustration: "high" }, null)).toBe(true);
  });

  it("moderada só oferece se o turno anterior também foi moderado ou alto", () => {
    expect(shouldOfferAnalyst({ frustration: "some" }, null)).toBe(false);
    expect(shouldOfferAnalyst({ frustration: "some" }, { frustration: "none" })).toBe(false);
    expect(shouldOfferAnalyst({ frustration: "some" }, { frustration: "some" })).toBe(true);
    expect(shouldOfferAnalyst({ frustration: "some" }, { frustration: "high" })).toBe(true);
  });

  it("sem frustração (ou sem o campo, em traces antigos) não oferece", () => {
    expect(shouldOfferAnalyst({ frustration: "none" }, { frustration: "high" })).toBe(false);
    expect(shouldOfferAnalyst({}, { frustration: "high" })).toBe(false);
  });
});
