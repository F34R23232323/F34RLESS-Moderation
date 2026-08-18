"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDuration = parseDuration;
exports.formatDuration = formatDuration;
exports.humanizeDuration = humanizeDuration;
const UNIT_MS = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    y: 31_536_000_000,
};
function parseDuration(input) {
    const s = String(input ?? '').trim().toLowerCase();
    if (s === 'perm' || s === 'permanent' || s === '0' || s === '') {
        return { milliseconds: 0, isPermanent: true };
    }
    const pattern = /(\d+(?:\.\d+)?)([smhdwy])/g;
    let total = 0;
    let match;
    let consumed = 0;
    while ((match = pattern.exec(s)) !== null) {
        const value = parseFloat(match[1]);
        const unit = match[2];
        total += value * UNIT_MS[unit];
        consumed += match[0].length;
    }
    const stripped = s.replace(/\s+/g, '');
    if (consumed !== stripped.length || total <= 0)
        return null;
    return { milliseconds: Math.round(total), isPermanent: false };
}
function formatDuration(ms) {
    if (ms <= 0)
        return 'permanent';
    const parts = [];
    const units = [
        [UNIT_MS.y, 'y'],
        [UNIT_MS.w, 'w'],
        [UNIT_MS.d, 'd'],
        [UNIT_MS.h, 'h'],
        [UNIT_MS.m, 'm'],
        [UNIT_MS.s, 's'],
    ];
    let rest = ms;
    for (const [unitMs, label] of units) {
        const count = Math.floor(rest / unitMs);
        if (count > 0) {
            parts.push(`${count}${label}`);
            rest -= count * unitMs;
        }
    }
    return parts.length > 0 ? parts.join('') : '0s';
}
function humanizeDuration(ms) {
    if (ms <= 0)
        return 'permanent';
    const mins = Math.round(ms / 60000);
    if (mins < 60)
        return `${mins} minute(s)`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours < 24)
        return remMins ? `${hours}h ${remMins}m` : `${hours} hour(s)`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours ? `${days}d ${remHours}h` : `${days} day(s)`;
}
//# sourceMappingURL=duration.js.map