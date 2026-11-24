const ONLY_WHITESPACE_OR_PUNCT = /^[\s\p{P}\p{S}]*$/u;
const STRIP_PUNCT_AND_SPACE = /[\s\p{P}\p{S}]+/gu;
const BOUNDARY_TOLERANCE_SECONDS = 0.1;
const OVERLAP_TOLERANCE_SECONDS = 0.1;

function matchTokenIgnoringPunct(segmentText, cursor, rawToken) {
  const normToken = rawToken.replace(STRIP_PUNCT_AND_SPACE, "").toLowerCase();
  if (!normToken) return null;
  let start = cursor;
  while (
    start < segmentText.length &&
    ONLY_WHITESPACE_OR_PUNCT.test(segmentText[start])
  ) {
    start++;
  }
  let pos = start;
  let matched = 0;
  while (pos < segmentText.length && matched < normToken.length) {
    const ch = segmentText[pos];
    if (ONLY_WHITESPACE_OR_PUNCT.test(ch)) {
      pos++;
      continue;
    }
    if (ch.toLowerCase() !== normToken[matched]) return null;
    matched++;
    pos++;
  }
  if (matched !== normToken.length) return null;
  return { start, end: pos };
}

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
    let matchEnd = matchPos >= 0 ? matchPos + rawToken.length : -1;
    if (matchPos < 0) {
      matchPos = segmentText
        .toLowerCase()
        .indexOf(rawToken.toLowerCase(), cursor);
      matchEnd = matchPos >= 0 ? matchPos + rawToken.length : -1;
    }
    if (matchPos < 0) {
      const fuzzy = matchTokenIgnoringPunct(segmentText, cursor, rawToken);
      if (!fuzzy) return undefined;
      matchPos = fuzzy.start;
      matchEnd = fuzzy.end;
    }

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

    const matchedText = segmentText.slice(matchPos, matchEnd);
    result.push({
      start: words[i].start,
      end: words[i].end,
      text: leadingPunct + matchedText,
    });
    cursor = matchEnd;
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
  const normalized = [];
  for (const word of words) {
    if (
      !word ||
      typeof word.text !== "string" ||
      !Number.isFinite(word.start) ||
      !Number.isFinite(word.end) ||
      word.end < word.start ||
      word.start < segment.start - BOUNDARY_TOLERANCE_SECONDS ||
      word.end > segment.end + BOUNDARY_TOLERANCE_SECONDS ||
      word.start < previous - OVERLAP_TOLERANCE_SECONDS
    )
      return undefined;
    const start = Math.max(
      previous,
      Math.min(segment.end, Math.max(segment.start, word.start))
    );
    const end = Math.max(start, Math.min(segment.end, word.end));
    normalized.push({ start, end, text: word.text });
    previous = start;
  }
  if (
    normalized
      .map((word) => word.text)
      .join("")
      .replace(/\s/g, "") === segment.text.replace(/\s/g, "")
  ) {
    return normalized;
  }
  const aligned = alignWordsWithPunctuation(normalized, segment.text);
  if (aligned) return aligned;
  // For multi-word ASR segments (e.g. number/contraction normalization differences
  // between segment.text and words[]), preserve real word timestamps rather than
  // collapsing an entire multi-minute segment into one unbreakable cue.
  if (normalized.length >= 6) {
    const wordsCompact = normalized
      .map((word) => word.text)
      .join("")
      .replace(STRIP_PUNCT_AND_SPACE, "");
    const segCompact = segment.text.replace(STRIP_PUNCT_AND_SPACE, "");
    if (
      wordsCompact.length > 0 &&
      segCompact.length > 0 &&
      wordsCompact.length >= segCompact.length * 0.7 &&
      wordsCompact.length <= segCompact.length * 1.35
    ) {
      return normalized;
    }
  }
  return undefined;
}
