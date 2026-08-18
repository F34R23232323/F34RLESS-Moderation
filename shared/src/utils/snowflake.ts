const DISCORD_EPOCH = 1420070400000;

export function isValidSnowflake(id: string): boolean {
  return /^\d{15,20}$/.test(id);
}

export function snowflakeToDate(id: string | bigint): Date | null {
  const s = String(id);
  if (!isValidSnowflake(s)) return null;
  const asBigInt = BigInt(s);
  const timestamp = Number((asBigInt >> 22n) + BigInt(DISCORD_EPOCH));
  return new Date(timestamp);
}

export function generateSnowflake(date: Date = new Date()): string {
  const ts = BigInt(date.getTime() - DISCORD_EPOCH);
  return String((ts << 22n) | 0n);
}

export function encodeUserIdTimestamp(ms: number): string {
  return String((BigInt(ms - DISCORD_EPOCH) << 22n) | 0n);
}