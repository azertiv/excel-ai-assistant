import { describe, expect, it } from "vitest";
import { extractCitations } from "@/utils/citations";

describe("extractCitations", () => {
  it("finds unique range references", () => {
    const citations = extractCitations("Use [[Sheet1!A1]] and [[Sheet1!A1:C3]] and [[Sheet1!A1]].");

    expect(citations).toHaveLength(2);
    expect(citations[0]?.address).toBe("Sheet1!A1");
    expect(citations[1]?.address).toBe("Sheet1!A1:C3");
  });
});
