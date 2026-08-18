export declare function levenshtein(a: string, b: string): number;
export interface SuggestionResult {
    candidate: string;
    distance: number;
}
export declare function suggestClosest(input: string, candidates: string[], maxDistance?: number): SuggestionResult | null;
