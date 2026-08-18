export declare function stripZeroWidth(input: string): string;
export declare function normalizeForMatching(input: string): string;
export declare function tokenize(input: string): string[];
export declare function jaccardSimilarity(a: string, b: string): number;
export declare function charNgramSimilarity(a: string, b: string, n?: number): number;
export declare function combinedSimilarity(a: string, b: string): number;
