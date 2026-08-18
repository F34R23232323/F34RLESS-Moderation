"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidSnowflake = isValidSnowflake;
exports.snowflakeToDate = snowflakeToDate;
exports.generateSnowflake = generateSnowflake;
exports.encodeUserIdTimestamp = encodeUserIdTimestamp;
const DISCORD_EPOCH = 1420070400000;
function isValidSnowflake(id) {
    return /^\d{15,20}$/.test(id);
}
function snowflakeToDate(id) {
    const s = String(id);
    if (!isValidSnowflake(s))
        return null;
    const asBigInt = BigInt(s);
    const timestamp = Number((asBigInt >> 22n) + BigInt(DISCORD_EPOCH));
    return new Date(timestamp);
}
function generateSnowflake(date = new Date()) {
    const ts = BigInt(date.getTime() - DISCORD_EPOCH);
    return String((ts << 22n) | 0n);
}
function encodeUserIdTimestamp(ms) {
    return String((BigInt(ms - DISCORD_EPOCH) << 22n) | 0n);
}
//# sourceMappingURL=snowflake.js.map