export function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const dp: number[] = new Array(bn + 1);
  for (let j = 0; j <= bn; j++) dp[j] = j;
  for (let i = 1; i <= an; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= bn; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[bn];
}

export interface SuggestionResult {
  candidate: string;
  distance: number;
}

export function suggestClosest(input: string, candidates: string[], maxDistance = 2): SuggestionResult | null {
  let best: SuggestionResult | null = null;
  for (const candidate of candidates) {
    const d = levenshtein(input.toLowerCase(), candidate.toLowerCase());
    if (d <= maxDistance) {
      if (!best || d < best.distance) best = { candidate, distance: d };
    }
  }
  return best;
}