jest.mock("query-string", () => ({
  stringify: (obj) => new URLSearchParams(obj).toString(),
}));

jest.mock("@streamparser/json", () => ({
  JSONParser: jest.fn(),
}));

jest.mock("../libs/fetch", () => ({
  fetchData: jest.fn(),
  fetchStream: jest.fn(),
}));

jest.mock("../libs/docInfo", () => ({
  getDocInfo: () => ({}),
}));

import { parseTransRes } from "./trans";
import { OPT_TRANS_OPENAI } from "../config";

const parse = (content) =>
  parseTransRes(
    { choices: [{ message: { content } }] },
    { apiType: OPT_TRANS_OPENAI, useBatchFetch: true }
  );

describe("parseTransRes batch fallback", () => {
  test("refuses malformed schema-like JSON instead of leaking it as a translation", async () => {
    expect(await parse('{"translations":[{"id":0,"text":"甲"')).toEqual([]);
  });

  test("keeps plaintext line fallback for bracket-prefixed translations", async () => {
    expect(await parse("[音乐]\n[已删除]")).toEqual([
      ["[音乐]", ""],
      ["[已删除]", ""],
    ]);
  });
});
