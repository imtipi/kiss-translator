const ONLY_WHITESPACE_OR_PUNCT = /^[\s\p{P}\p{S}]*$/u;

/**
 * Reattach punctuation from `segmentText` onto ordered ASR word tokens
 * (for models like Qwen3-ASR that omit punctuation from word-level timestamps).
 * Returns undefined if any non-punctuation text is missing or mismatched.
 */
function alignWordsWithPunctuation(words, segmentText) {
  const result = [];
  let cursor = 0;

  for (let i = 0; i < words.length; i++) {
    const rawToken = words[i].text.trim();
    if (!rawToken) return undefined;

    let matchPos = segmentText.indexOf(rawToken, cursor);
    if (matchPos < 0) {
      matchPos = segmentText
        .toLowerCase()
        .indexOf(rawToken.toLowerCase(), cursor);
    }
    if (matchPos < 0) return undefined;

    const gap = segmentText.slice(cursor, matchPos);
    if (!ONLY_WHITESPACE_OR_PUNCT.test(gap)) return undefined;

    let leadingPunct = "";
    if (gap) {
      if (i === 0) {
        leadingPunct = gap.trim();
      } else {
        const wsIndex = gap.search(/\s/);
        if (wsIndex >= 0) {
          const prevTrailing = gap.slice(0, wsIndex).trim();
          if (prevTrailing) result[result.length - 1].text += prevTrailing;
          leadingPunct = gap.slice(wsIndex).trim();
        } else {
          // No whitespace between words (e.g. CJK or hyphenated punctuation): attach to previous word.
          result[result.length - 1].text += gap;
        }
      }
    }

    const matchedText = segmentText.slice(matchPos, matchPos + rawToken.length);
    result.push({
      start: words[i].start,
      end: words[i].end,
      text: leadingPunct + matchedText,
    });
    cursor = matchPos + rawToken.length;
  }

  const tail = segmentText.slice(cursor);
  if (!ONLY_WHITESPACE_OR_PUNCT.test(tail)) return undefined;
  const trimmedTail = tail.trim();
  if (trimmedTail && result.length) {
    result[result.length - 1].text += trimmedTail;
  }

  if (
    result
      .map((word) => word.text)
      .join("")
      .replace(/\s/g, "") !== segmentText.replace(/\s/g, "")
  )
    return undefined;

  return result;
}

/** Optional aligned words are usable only when they cover the unchanged segment text. */
export function alignedAsrWords(segment) {
  const words = segment.words;
  if (
    segment.wordsTimingSource === "estimated" ||
    !Array.isArray(words) ||
    !words.length ||
    words.length > 10000
  )
    return undefined;
  let previous = segment.start;
  for (const word of words) {
    if (
      !word ||
      typeof word.text !== "string" ||
      !Number.isFinite(word.start) ||
      !Number.isFinite(word.end) ||
      word.start < previous ||
      word.end < word.start ||
      word.start < segment.start ||
      word.end > segment.end
    )
      return undefined;
    previous = word.start;
  }
  if (
    words
      .map((word) => word.text)
      .join("")
      .replace(/\s/g, "") === segment.text.replace(/\s/g, "")
  ) {
    return words.map(({ start, end, text }) => ({ start, end, text }));
  }
  return alignWordsWithPunctuation(words, segment.text);
}
