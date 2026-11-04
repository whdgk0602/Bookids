import { describe, expect, it } from "vitest";
import { toStrictSchema } from "./groq-chat";

describe("toStrictSchema", () => {
  it("모든 객체에 additionalProperties: false를 넣고 개수 제한·설명을 뺀다", () => {
    const schema = {
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" }, maxItems: 4, description: "태그" },
        choices: {
          type: "array",
          maxItems: 3,
          items: { type: "object", properties: { label: { type: "string" } }, required: ["label"] },
        },
      },
      required: ["tags", "choices"],
    };
    expect(toStrictSchema(schema)).toEqual({
      type: "object",
      additionalProperties: false,
      properties: {
        tags: { type: "array", items: { type: "string" } },
        choices: {
          type: "array",
          items: { type: "object", additionalProperties: false, properties: { label: { type: "string" } }, required: ["label"] },
        },
      },
      required: ["tags", "choices"],
    });
  });

  it("원본 스키마를 바꾸지 않는다", () => {
    const schema = { type: "object", properties: {}, maxItems: 1 };
    toStrictSchema(schema);
    expect(schema).toEqual({ type: "object", properties: {}, maxItems: 1 });
  });
});
