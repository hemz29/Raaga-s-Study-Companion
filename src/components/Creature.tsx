import type { Mood, StageId, WorldId } from '../types';
import { WORLDS } from '../lib/worlds';
import { useImage } from '../lib/useImage';

interface Props {
  stage: StageId;
  world: WorldId;
  mood?: Mood;
  size?: number;
  cosmetics?: string[];
  customArtId?: string;
  wobble?: boolean;
  cracks?: number; // 0-3, for the hatch sequence
}

/** Placeholder art. Raaga can replace any stage with her own drawing from the art room. */
export function Creature({ stage, world, mood = 'content', size = 220, cosmetics = [], customArtId, wobble, cracks = 0 }: Props) {
  const custom = useImage(customArtId);
  const p = WORLDS[world].palette;
  const asleep = mood === 'paused' || mood === 'sleepy';
  const cls = `creature ${wobble ? 'wobble' : ''} ${asleep ? 'asleep' : 'bob'} mood-${mood}`;

  if (custom && stage !== 'egg') {
    return (
      <div className={cls} style={{ width: size, height: size }}>
        <img src={custom} alt="Your creature" className="creature-custom" />
        {asleep && <span className="zzz">z z z</span>}
      </div>
    );
  }

  if (stage === 'egg') {
    return (
      <svg className={cls} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="A mysterious egg">
        <ellipse cx="100" cy="182" rx="50" ry="8" fill="rgba(0,0,0,.18)" />
        <ellipse cx="100" cy="108" rx="58" ry="74" fill={p.egg} stroke={p.accent} strokeWidth="3" />
        <circle cx="78" cy="88" r="9" fill={p.eggSpots} opacity=".7" />
        <circle cx="122" cy="128" r="12" fill={p.eggSpots} opacity=".6" />
        <circle cx="112" cy="70" r="6" fill={p.eggSpots} opacity=".7" />
        <circle cx="84" cy="146" r="7" fill={p.eggSpots} opacity=".6" />
        <ellipse cx="80" cy="72" rx="12" ry="20" fill="#fff" opacity=".35" />
        {cracks >= 1 && <path d="M70 100 l12 -10 l10 12 l10 -14" stroke={p.accent} strokeWidth="3" fill="none" strokeLinecap="round" />}
        {cracks >= 2 && <path d="M102 88 l12 12 l14 -10 l12 8" stroke={p.accent} strokeWidth="3" fill="none" strokeLinecap="round" />}
        {cracks >= 3 && <path d="M64 120 l18 6 l10 -8 l14 10 l16 -6 l16 4" stroke={p.accent} strokeWidth="3" fill="none" strokeLinecap="round" />}
      </svg>
    );
  }

  const scale = { hatchling: 0.7, juvenile: 0.8, teen: 0.88, adult: 0.95, mythic: 1 }[stage];
  const showEars = stage !== 'hatchling';
  const showWings = stage === 'teen' || stage === 'adult' || stage === 'mythic';
  const bigWings = stage === 'adult' || stage === 'mythic';

  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={`Your creature, ${mood}`}>
      <ellipse cx="100" cy="186" rx={56 * scale} ry="7" fill="rgba(0,0,0,.18)" />
      {stage === 'mythic' && <circle cx="100" cy="100" r="92" fill={p.belly} opacity=".25" className="aura" />}
      <g transform={`translate(${100 - 100 * scale} ${190 - 190 * scale}) scale(${scale})`}>
        {showWings && (
          <g fill={p.accent} opacity=".85">
            <path d={bigWings ? 'M50 100 C0 60 10 30 30 40 C40 60 50 70 62 86 Z' : 'M56 104 C30 84 30 66 42 70 C50 80 56 88 64 96 Z'} />
            <path d={bigWings ? 'M150 100 C200 60 190 30 170 40 C160 60 150 70 138 86 Z' : 'M144 104 C170 84 170 66 158 70 C150 80 144 88 136 96 Z'} />
          </g>
        )}
        {showEars && (
          <g fill={p.body}>
            <path d="M62 64 L52 22 L86 52 Z" />
            <path d="M138 64 L148 22 L114 52 Z" />
            <path d="M64 58 L58 34 L78 52 Z" fill={p.belly} />
            <path d="M136 58 L142 34 L122 52 Z" fill={p.belly} />
          </g>
        )}
        <path d="M150 150 C182 150 186 120 172 112" stroke={p.body} strokeWidth="12" fill="none" strokeLinecap="round" />
        <ellipse cx="100" cy="118" rx="62" ry="64" fill={p.body} />
        <ellipse cx="100" cy="136" rx="38" ry="38" fill={p.belly} />
        <ellipse cx="72" cy="178" rx="16" ry="9" fill={p.body} />
        <ellipse cx="128" cy="178" rx="16" ry="9" fill={p.body} />
        {asleep ? (
          <g stroke="#2a2340" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M68 102 q10 8 20 0" />
            <path d="M112 102 q10 8 20 0" />
          </g>
        ) : (
          <g>
            <ellipse cx="78" cy="100" rx="11" ry="13" fill="#2a2340" />
            <ellipse cx="122" cy="100" rx="11" ry="13" fill="#2a2340" />
            <circle cx="82" cy="95" r="4" fill="#fff" />
            <circle cx="126" cy="95" r="4" fill="#fff" />
          </g>
        )}
        <circle cx="62" cy="120" r="7" fill="#f29c9c" opacity=".55" />
        <circle cx="138" cy="120" r="7" fill="#f29c9c" opacity=".55" />
        <path d={mood === 'radiant' || mood === 'happy' ? 'M90 122 q10 10 20 0' : 'M92 124 q8 4 16 0'} stroke="#2a2340" strokeWidth="3" fill="none" strokeLinecap="round" />
        {cosmetics.includes('detective-monocle') && (
          <g>
            <circle cx="122" cy="100" r="17" fill="none" stroke="#d4a72c" strokeWidth="3" />
            <path d="M138 108 q6 20 -4 34" stroke="#d4a72c" strokeWidth="2" fill="none" />
          </g>
        )}
        {cosmetics.includes('star-cloak') && <path d="M54 140 Q100 170 146 140 L150 176 Q100 196 50 176 Z" fill="#3b2d7a" opacity=".85" />}
        {stage === 'mythic' && <path d="M76 44 L84 30 L92 42 L100 26 L108 42 L116 30 L124 44 Z" fill="#f5c84c" stroke="#b58a1c" strokeWidth="2" />}
      </g>
      {asleep && <text x="150" y="50" className="zzz-svg">z z z</text>}
    </svg>
  );
}
