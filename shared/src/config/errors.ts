export interface ConfigIssue {
  path: string;
  expected: string;
  found: string;
}

export class ConfigValidationError extends Error {
  public readonly issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    super(`Config validation failed with ${issues.length} issue(s)`);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }

  public formatHumanReadable(): string {
    const lines = this.issues.map(
      (i) => `  - ${i.path}\n      expected: ${i.expected}\n      found:    ${i.found}`,
    );
    return `Invalid configuration:\n${lines.join('\n')}`;
  }
}