export interface MusicFilterDef {
  /** Key used in DisTube customFilters / queue.filters */
  key: string;
  label: string;
  emoji: string;
  /** FFmpeg audio filter chain */
  value: string;
}

export const MUSIC_FILTERS: MusicFilterDef[] = [
  { key: 'bassboost', label: 'Bass Boost', emoji: '🔊', value: 'bass=g=10' },
  { key: 'bassboost_heavy', label: 'Bass Boost+', emoji: '🎸', value: 'bass=g=20,treble=g=6' },
  { key: 'slowed', label: 'Slowed', emoji: '🐢', value: 'atempo=0.85' },
  { key: 'reverb', label: 'Reverb', emoji: '🏟️', value: 'aecho=0.8:0.9:60|80|100:0.4|0.3|0.2' },
  { key: 'slowedreverb', label: 'Slowed + Reverb', emoji: '🌊', value: 'atempo=0.85,aecho=0.8:0.9:60|80|100:0.4|0.3|0.2' },
  { key: 'bassboost_slowed', label: 'Bass Boost + Slowed', emoji: '🐢', value: 'bass=g=10,atempo=0.85' },
  { key: 'bassboost_reverb', label: 'Bass Boost + Reverb', emoji: '🎸', value: 'bass=g=10,aecho=0.8:0.9:60|80|100:0.4|0.3|0.2' },
  { key: 'nightcore', label: 'Nightcore', emoji: '⚡', value: 'asetrate=48000*1.25,aresample=48000,bass=g=5' },
  { key: 'vaporwave', label: 'Vaporwave', emoji: '🌴', value: 'asetrate=48000*0.8,aresample=48000,atempo=1.1' },
  { key: '8d', label: '8D', emoji: '🌀', value: 'apulsator=hz=0.08' },
  { key: '3d', label: '3D', emoji: '🧊', value: 'apulsator=hz=0.125' },
  { key: 'echo', label: 'Echo', emoji: '🗣️', value: 'aecho=0.8:0.9:1000:0.3' },
  { key: 'karaoke', label: 'Karaoke', emoji: '🎤', value: 'stereotools=mlev=0.1' },
  { key: 'treble', label: 'Treble', emoji: '✨', value: 'treble=g=8' },
  { key: 'phaser', label: 'Phaser', emoji: '🛸', value: 'aphaser' },
  { key: 'tremolo', label: 'Tremolo', emoji: '🫨', value: 'tremolo' },
  { key: 'flanger', label: 'Flanger', emoji: '🎹', value: 'flanger' },
  { key: 'surround', label: 'Surround', emoji: '🔉', value: 'surround' },
  { key: 'haas', label: 'Haas', emoji: '🪞', value: 'haas' },
  { key: 'mcompand', label: 'Compressor', emoji: '🎚️', value: 'mcompand' },
  { key: 'gate', label: 'Gate', emoji: '🚪', value: 'agate' },
  { key: 'earwax', label: 'Earwax', emoji: '👂', value: 'earwax' },
  { key: 'reverse', label: 'Reverse', emoji: '🔁', value: 'areverse' },
];

const byKey = new Map(MUSIC_FILTERS.map((f) => [f.key, f]));

export function getMusicFilter(key: string): MusicFilterDef | undefined {
  return byKey.get(key);
}

export function toCustomFilters(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of MUSIC_FILTERS) out[f.key] = f.value;
  return out;
}