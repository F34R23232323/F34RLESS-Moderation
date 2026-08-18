export type PlaceholderContext = Record<string, string | number | null | undefined>;
export declare function renderPlaceholders(template: string, ctx: PlaceholderContext): string;
export declare function listMissingPlaceholders(template: string, ctx: PlaceholderContext): string[];
