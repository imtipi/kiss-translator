import { alignedAsrWords } from "./asrWords";

const segment = {
  start: 1,
  end: 3,
  text: "Hello, world!",
  words: [
    { start: 1, end: 1.4, text: "Hello," },
    { start: 2, end: 3, text: " world!" },
  ],
};
test("preserves real word endpoints and punctuation without inventing missing text", () => {
  expect(alignedAsrWords(segment)).toEqual(segment.words);
  expect(
    alignedAsrWords({ ...segment, text: "Hello, missing world!" })
  ).toBeUndefined();
  expect(
    alignedAsrWords({ ...segment, wordsTimingSource: "estimated" })
  ).toBeUndefined();
});
test("reattaches segment punctuation when ASR word tokens omit punctuation", () => {
  expect(
    alignedAsrWords({
      start: 0.08,
      end: 9.92,
      text: "Hello everyone. “Today,” we test!",
      words: [
        { start: 0.08, end: 0.4, text: "Hello" },
        { start: 0.4, end: 1.12, text: "everyone" },
        { start: 1.92, end: 2.32, text: "Today" },
        { start: 2.32, end: 2.56, text: "we" },
        { start: 2.56, end: 9.92, text: "test" },
      ],
    })
  ).toEqual([
    { start: 0.08, end: 0.4, text: "Hello" },
    { start: 0.4, end: 1.12, text: "everyone." },
    { start: 1.92, end: 2.32, text: "“Today,”" },
    { start: 2.32, end: 2.56, text: "we" },
    { start: 2.56, end: 9.92, text: "test!" },
  ]);
});
test.each([
  [{ start: NaN, end: 3, text: "Hello, world!" }],
  [{ start: 0, end: 3, text: "Hello, world!" }],
  [{ start: 1, end: 4, text: "Hello, world!" }],
  [
    { start: 2, end: 3, text: "Hello," },
    { start: 1, end: 2, text: " world!" },
  ],
])(
  "invalid optional word timestamps fall back to the segment: %j",
  (...words) => {
    expect(alignedAsrWords({ ...segment, words })).toBeUndefined();
  }
);
