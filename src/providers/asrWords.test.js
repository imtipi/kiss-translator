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

test("tolerates minor boundary jitter, punctuation contractions, and long-segment normalization differences", () => {
  expect(
    alignedAsrWords({
      start: 1.0,
      end: 4.0,
      text: `J.T. didn't reply, "Nope!"`,
      words: [
        { start: 0.96, end: 1.4, text: "JT" },
        { start: 1.38, end: 2.0, text: "didnt" },
        { start: 2.0, end: 2.8, text: "reply" },
        { start: 2.8, end: 4.04, text: "Nope" },
      ],
    })
  ).toEqual([
    { start: 1.0, end: 1.4, text: "J.T." },
    { start: 1.38, end: 2.0, text: "didn't" },
    { start: 2.0, end: 2.8, text: "reply," },
    { start: 2.8, end: 4.0, text: '"Nope!"' },
  ]);

  const longFallback = alignedAsrWords({
    start: 0,
    end: 10,
    text: "At 2058 hours the fleet moved forward without delay.",
    words: [
      { start: 0, end: 0.5, text: "At" },
      { start: 0.5, end: 1.5, text: "twenty" },
      { start: 1.5, end: 2.2, text: "fifty" },
      { start: 2.2, end: 2.8, text: "eight" },
      { start: 2.8, end: 3.5, text: "hours" },
      { start: 3.5, end: 4.2, text: "the" },
      { start: 4.2, end: 5.5, text: "fleet" },
      { start: 5.5, end: 7.0, text: "moved" },
      { start: 7.0, end: 8.5, text: "forward" },
      { start: 8.5, end: 9.2, text: "without" },
      { start: 9.2, end: 10, text: "delay" },
    ],
  });
  expect(longFallback).toHaveLength(11);
  expect(longFallback[0]).toEqual({ start: 0, end: 0.5, text: "At" });
});
