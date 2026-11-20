// 캐릭터 프로필 이미지: 부품(피부·머리·수염·구레나룻·안경·눈·복장·장신구)을 골라 SVG로 조립한다.
// 선생님(플레이어)과 멘토(선배 교사)가 같이 쓴다. "세계관 기본"은 지금 세계관에 맞는 모습을 따른다.
import { esc } from './ui.js';

const AUTO = 'auto';
export const OPTIONS = {
  skin: { label: '피부', type: 'color', values: [['#f6d5b8', '밝은 편'], ['#f2c9a5', '보통'], ['#d9a77e', '구릿빛'], ['#a8754f', '진한 편']] },
  hair: { label: '머리 모양', values: [[AUTO, '세계관 기본'], ['short', '짧은 머리'], ['side', '가르마'], ['buzz', '스포츠'], ['curly', '곱슬'], ['long', '긴 머리'], ['ponytail', '묶은 머리'], ['bun', '상투'], ['undercut', '투블럭'], ['bald', '민머리']] },
  hairColor: { label: '머리 색', type: 'color', values: [['#16120f', '검정'], ['#3a2a20', '흑갈색'], ['#6b4428', '갈색'], ['#a0703c', '밝은 갈색'], ['#d8b25a', '금색'], ['#9aa0a6', '회색'], ['#e8e8e8', '흰색'], ['#a33b2a', '빨강']] },
  beard: { label: '수염', values: [['none', '없음'], ['stubble', '거뭇거뭇'], ['mustache', '콧수염'], ['goatee', '염소수염'], ['full', '턱수염']] },
  sideburns: { label: '구레나룻', values: [['none', '없음'], ['short', '짧게'], ['long', '길게']] },
  glasses: { label: '안경', values: [[AUTO, '세계관 기본'], ['none', '없음'], ['round', '동그란 안경'], ['square', '네모 안경'], ['half', '반무테'], ['sun', '선글라스']] },
  eye: { label: '눈 색', type: 'color', values: [['#1c2330', '검정'], ['#5a3a22', '갈색'], ['#2f6fb0', '파랑'], ['#3c8a4a', '초록'], ['#6b7480', '회색'], ['#8a4fb0', '보라']] },
  outfit: { label: '복장', values: [[AUTO, '세계관 기본'], ['cardigan', '가디건·명찰'], ['suit', '정장'], ['track', '체육복'], ['hoodie', '후드티'], ['robe', '도포'], ['wizard', '마법사 로브'], ['cyber', '사이버 재킷']] },
  cloth: { label: '복장 색', type: 'color', values: [[AUTO, '세계관 기본'], ['#2f4a6d', '남색'], ['#22262e', '검정'], ['#6b7480', '회색'], ['#7a5534', '갈색'], ['#2d6a4a', '초록'], ['#6a2f5a', '자주'], ['#3b2f78', '보라'], ['#e8e1d2', '흰색'], ['#9b2f2a', '빨강'], ['#4a86b8', '하늘']] },
  acc: { label: '장신구', values: [[AUTO, '세계관 기본'], ['none', '없음'], ['hat', '마법사 모자'], ['visor', '바이저'], ['band', '머리띠'], ['hairpin', '비녀']] },
};

export const MENTOR_LOOK = { skin: '#f2c9a5', hair: AUTO, hairColor: AUTO, beard: 'none', sideburns: 'none', glasses: AUTO, eye: '#1c2330', outfit: AUTO, cloth: AUTO, acc: AUTO };
export const PLAYER_LOOK = { skin: '#f6d5b8', hair: 'side', hairColor: '#16120f', beard: 'none', sideburns: 'none', glasses: 'none', eye: '#1c2330', outfit: AUTO, cloth: AUTO, acc: AUTO };

// 세계관 기본 모습
const WORLD = {
  real: { hair: 'short', hairColor: '#3a2a20', glasses: 'round', outfit: 'cardigan', cloth: '#2f4a6d', acc: 'none' },
  wuxia: { hair: 'bun', hairColor: '#16120f', glasses: 'none', outfit: 'robe', cloth: '#e8e1d2', acc: 'hairpin' },
  magic: { hair: 'short', hairColor: '#5a3a26', glasses: 'round', outfit: 'wizard', cloth: '#3b2f78', acc: 'hat' },
  cyber: { hair: 'undercut', hairColor: '#2a2f3a', glasses: 'none', outfit: 'cyber', cloth: '#1d2430', acc: 'visor' },
};
const OUTFIT_CLOTH = { cardigan: '#2f4a6d', suit: '#22262e', track: '#2d6a4a', hoodie: '#6b7480', robe: '#e8e1d2', wizard: '#3b2f78', cyber: '#1d2430' };

export function resolveLook(look = {}, world = 'real') {
  const w = WORLD[world] ?? WORLD.real;
  const L = { ...MENTOR_LOOK, ...look };
  const out = { ...L };
  for (const k of ['hair', 'glasses', 'outfit', 'acc']) if (L[k] === AUTO) out[k] = w[k];
  if (L.hairColor === AUTO) out.hairColor = w.hairColor;
  if (L.cloth === AUTO) out.cloth = L.outfit === AUTO ? w.cloth : OUTFIT_CLOTH[out.outfit] ?? w.cloth;
  return out;
}

// ---------- 부품 ----------

function hairBack(L) {
  const c = L.hairColor;
  if (L.hair === 'long') return `<path d="M52 104 C48 58 80 42 100 44 C124 44 154 58 148 104 L154 176 C130 186 70 186 46 176 Z" fill="${c}"/>`;
  if (L.hair === 'ponytail') return `<path d="M136 76 C162 80 168 120 156 160 C150 140 146 116 132 98 Z" fill="${c}"/>`;
  if (L.hair === 'bun') return `<circle cx="100" cy="46" r="15" fill="${c}"/>`;
  return '';
}
function hairFront(L) {
  const c = L.hairColor;
  switch (L.hair) {
    case 'short': return `<path d="M56 104 C50 60 80 46 102 48 C132 48 152 66 146 104 C140 84 124 74 100 76 C82 76 64 86 56 104 Z" fill="${c}"/>`;
    case 'side': case 'long': case 'ponytail':
      return `<path d="M56 108 C50 58 82 44 108 48 C134 52 152 70 146 108 C142 86 134 76 118 72 C106 82 84 82 66 90 C61 95 58 101 56 108 Z" fill="${c}"/>`;
    case 'buzz': return `<path d="M60 98 C60 66 80 56 100 56 C122 56 142 66 140 98 C130 80 116 74 100 74 C84 74 70 80 60 98 Z" fill="${c}" opacity=".8"/>`;
    case 'curly': return `<g fill="${c}">${[[62, 92], [66, 76], [78, 63], [93, 57], [108, 57], [122, 63], [134, 76], [138, 92], [86, 70], [114, 70], [100, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13"/>`).join('')}</g>`;
    case 'bun': return `<path d="M56 106 C50 58 80 46 100 48 C122 48 152 60 144 106 C140 80 122 70 100 70 C80 70 62 80 56 106 Z" fill="${c}"/>`;
    case 'undercut': return `<path d="M58 96 C56 62 82 50 104 52 C130 54 148 68 144 92 L144 80 C132 70 118 66 100 68 C82 70 66 78 58 96 Z" fill="${c}"/><rect x="56" y="86" width="6" height="22" fill="${c}" opacity=".4"/><rect x="138" y="86" width="6" height="22" fill="${c}" opacity=".4"/>`;
    case 'bald': return '<ellipse cx="88" cy="70" rx="10" ry="5" fill="#ffffff" opacity=".35"/>';
    default: return '';
  }
}
function sideburns(L) {
  if (L.sideburns === 'none' || L.hair === 'bald') return '';
  const h = L.sideburns === 'long' ? 34 : 20;
  return `<g fill="${L.hairColor}"><rect x="59" y="94" width="8" height="${h}" rx="3"/><rect x="133" y="94" width="8" height="${h}" rx="3"/></g>`;
}
function beard(L) {
  const c = L.hairColor;
  const mus = `<path d="M84 129 C91 123 98 125 100 128 C102 125 109 123 116 129 C110 133 104 132 100 130 C96 132 90 133 84 129 Z" fill="${c}"/>`;
  switch (L.beard) {
    case 'stubble': return `<path d="M62 118 C64 150 84 158 100 158 C116 158 136 150 138 118 C130 140 116 148 100 148 C84 148 70 140 62 118 Z" fill="${c}" opacity=".28"/>`;
    case 'mustache': return mus;
    case 'goatee': return `${mus}<path d="M90 140 C92 156 108 156 110 140 C104 145 96 145 90 140 Z" fill="${c}"/>`;
    case 'full': return `<path d="M58 110 C58 152 80 162 100 162 C120 162 142 152 142 110 C138 128 130 138 120 142 C112 138 88 138 80 142 C70 138 62 128 58 110 Z" fill="${c}"/>${mus}`;
    default: return '';
  }
}
function eyes(L) {
  return `<g class="npc-eyes"><ellipse cx="84" cy="108" rx="4.5" ry="5.5" fill="${L.eye}"/><ellipse cx="116" cy="108" rx="4.5" ry="5.5" fill="${L.eye}"/>
    <circle cx="85.5" cy="106" r="1.4" fill="#fff"/><circle cx="117.5" cy="106" r="1.4" fill="#fff"/></g>
    <path d="M76 96 Q84 92 92 96 M108 96 Q116 92 124 96" stroke="${L.hair === 'bald' ? '#5a3a22' : L.hairColor}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}
function glasses(L) {
  switch (L.glasses) {
    case 'round': return '<g fill="none" stroke="#1c2330" stroke-width="2"><circle cx="84" cy="108" r="12"/><circle cx="116" cy="108" r="12"/><path d="M96 107 L104 107 M72 106 L62 102 M128 106 L138 102"/></g>';
    case 'square': return '<g fill="none" stroke="#1c2330" stroke-width="2.4"><rect x="72" y="99" width="24" height="18" rx="3"/><rect x="104" y="99" width="24" height="18" rx="3"/><path d="M96 106 L104 106 M72 104 L62 101 M128 104 L138 101"/></g>';
    case 'half': return '<g fill="none" stroke="#1c2330" stroke-linecap="round"><path d="M72 101 Q84 97 96 101 M104 101 Q116 97 128 101" stroke-width="3.5"/><path d="M72 101 Q72 114 84 116 Q96 114 96 101 M104 101 Q104 114 116 116 Q128 114 128 101" stroke-width="1"/><path d="M96 102 L104 102" stroke-width="2"/></g>';
    case 'sun': return '<g><rect x="70" y="99" width="27" height="17" rx="7" fill="#14181f" opacity=".92"/><rect x="103" y="99" width="27" height="17" rx="7" fill="#14181f" opacity=".92"/><path d="M97 105 L103 105" stroke="#14181f" stroke-width="2.5"/></g>';
    default: return '';
  }
}
function outfit(L) {
  const c = L.cloth;
  const shape = (d = 'M18 240 C24 186 60 170 100 170 C140 170 176 186 182 240 Z') => `<path d="${d}" fill="${c}"/>`;
  switch (L.outfit) {
    case 'cardigan': return `${shape()}<path d="M82 170 L100 204 L118 170 Z" fill="#ffffff"/><path d="M96 176 L100 214 L104 176 Z" fill="#8a3b3b"/>
      <path d="M86 172 L96 226 M114 172 L104 226" stroke="#d9a520" stroke-width="2" fill="none"/><rect x="88" y="222" width="24" height="16" rx="2" fill="#ffffff" stroke="#c9ced6"/>`;
    case 'suit': return `${shape()}<path d="M84 170 L100 212 L116 170 Z" fill="#ffffff"/><path d="M96 176 L100 222 L104 176 Z" fill="#3d6fb6"/>
      <path d="M78 172 L96 214 L84 240 M122 172 L104 214 L116 240" stroke="#000" stroke-opacity=".25" stroke-width="2" fill="none"/>`;
    case 'track': return `${shape()}<path d="M86 170 Q100 182 114 170" stroke="#ffffff" stroke-width="5" fill="none"/><path d="M100 178 L100 240" stroke="#d8dce2" stroke-width="2.5"/>
      <path d="M40 200 L58 240 M160 200 L142 240" stroke="#ffffff" stroke-width="4"/>`;
    case 'hoodie': return `${shape()}<path d="M70 168 C76 190 124 190 130 168 C120 178 80 178 70 168 Z" fill="#000" opacity=".2"/>
      <path d="M92 182 L90 214 M108 182 L110 214" stroke="#ffffff" stroke-width="2"/><rect x="74" y="214" width="52" height="20" rx="6" fill="#000" opacity=".12"/>`;
    case 'robe': return `${shape()}<path d="M72 174 L122 240" stroke="#8a3b24" stroke-width="9"/><path d="M128 174 L96 214" stroke="#8a3b24" stroke-width="9"/>
      <rect x="40" y="226" width="120" height="10" fill="#8a3b24" opacity=".9"/>`;
    case 'wizard': return `${shape('M14 240 C22 182 60 168 100 168 C140 168 178 182 186 240 Z')}<path d="M80 170 L100 198 L120 170" fill="none" stroke="#e2b94a" stroke-width="3"/>
      <circle cx="100" cy="200" r="6" fill="#e2b94a"/><path d="M100 194 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1 z" fill="#fff6d0"/>`;
    case 'cyber': return `${shape()}<path d="M62 184 L82 240 M138 184 L118 240" stroke="#3cf0ff" stroke-width="2.5"/><path d="M84 172 L100 196 L116 172" fill="none" stroke="#3cf0ff" stroke-width="2"/>
      <circle cx="140" cy="206" r="4" fill="#3cf0ff"/>`;
    default: return shape();
  }
}
function accBack(L) {
  return L.acc === 'hairpin' ? '<line x1="78" y1="40" x2="124" y2="52" stroke="#c9a46a" stroke-width="3" stroke-linecap="round"/>' : '';
}
function accFront(L) {
  switch (L.acc) {
    case 'hat': return `<path d="M64 70 L108 4 L138 70 Z" fill="${L.outfit === 'wizard' ? L.cloth : '#3b2f78'}"/><rect x="66" y="58" width="70" height="9" fill="#e2b94a"/>
      <ellipse cx="100" cy="70" rx="62" ry="11" fill="${L.outfit === 'wizard' ? L.cloth : '#3b2f78'}"/><circle cx="116" cy="34" r="3" fill="#fff6d0"/>`;
    case 'band': return '<path d="M58 84 C70 66 130 66 142 84" stroke="#c0472f" stroke-width="7" fill="none" stroke-linecap="round"/>';
    default: return '';
  }
}
const visor = (L) => (L.acc === 'visor' ? '<rect x="58" y="98" width="84" height="18" rx="9" fill="#0d2a33"/><rect x="60" y="100" width="80" height="14" rx="7" fill="#3cf0ff" opacity=".75"/><g class="npc-eyes"><rect x="78" y="104" width="12" height="5" rx="2" fill="#e8ffff"/><rect x="110" y="104" width="12" height="5" rx="2" fill="#e8ffff"/></g>' : '');

// 전체 그림. crop: 얼굴만 (작은 동그라미용)
export function avatarSvg(look, world = 'real', { cls = '', label = '캐릭터', crop = false } = {}) {
  const L = resolveLook(look, world);
  const skinDark = shade(L.skin, -0.08);
  const box = crop ? '40 36 120 130' : '0 0 200 240';
  return `<svg class="avatar-svg ${cls}" viewBox="${box}" role="img" aria-label="${esc(label)}">
    ${hairBack(L)}${accBack(L)}
    ${outfit(L)}
    <rect x="88" y="140" width="24" height="34" rx="8" fill="${skinDark}"/>
    <ellipse cx="58" cy="110" rx="7" ry="10" fill="${skinDark}"/><ellipse cx="142" cy="110" rx="7" ry="10" fill="${skinDark}"/>
    ${sideburns(L)}
    <ellipse cx="100" cy="106" rx="42" ry="48" fill="${L.skin}"/>
    ${beard(L)}
    ${L.acc === 'visor' ? '' : eyes(L)}
    <circle cx="76" cy="124" r="6" fill="#e88a7a" opacity=".3"/><circle cx="124" cy="124" r="6" fill="#e88a7a" opacity=".3"/>
    <path class="npc-smile" d="M88 133 Q100 141 112 133" stroke="#8a3b3b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse class="npc-mouth" cx="100" cy="136" rx="7" ry="5" fill="#8a3b3b"/>
    ${hairFront(L)}${accFront(L)}
    ${L.acc === 'visor' ? visor(L) : glasses(L)}
  </svg>`;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---------- 편집기 ----------

export function avatarEditor(look, world, id) {
  const L = { ...MENTOR_LOOK, ...look };
  return `<div class="av-editor" id="${id}">
    <div class="av-preview">${avatarSvg(L, world)}</div>
    <div class="av-fields">${Object.entries(OPTIONS).map(([k, o]) => `
      <div class="av-row"><span class="av-label">${o.label}</span><div class="av-opts" role="radiogroup" aria-label="${o.label}">
        ${o.values.map(([v, name]) => o.type === 'color' && v !== AUTO
          ? `<button type="button" class="av-sw${L[k] === v ? ' on' : ''}" data-k="${k}" data-v="${v}" role="radio" aria-checked="${L[k] === v}" title="${name}" aria-label="${name}" style="--sw:${v}"></button>`
          : `<button type="button" class="av-chip${L[k] === v ? ' on' : ''}" data-k="${k}" data-v="${v}" role="radio" aria-checked="${L[k] === v}">${name}</button>`).join('')}
      </div></div>`).join('')}
      <div class="row"><button type="button" class="btn small" data-av="random">무작위</button><button type="button" class="btn small" data-av="reset">처음 모습으로</button></div>
    </div>
  </div>`;
}

// 편집기 연결: 고를 때마다 onChange(새 모습)
export function bindAvatarEditor(root, look, world, defaults, onChange) {
  const ed = root;
  if (!ed) return;
  ed.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    let next;
    if (b.dataset.k) next = { ...MENTOR_LOOK, ...look, [b.dataset.k]: b.dataset.v };
    else if (b.dataset.av === 'reset') next = { ...defaults };
    else if (b.dataset.av === 'random') {
      next = {};
      for (const [k, o] of Object.entries(OPTIONS)) { const vs = o.values.map((x) => x[0]); next[k] = vs[Math.floor(Math.random() * vs.length)]; }
      if (Math.random() < 0.6) next.beard = 'none';
      if (Math.random() < 0.5) next.acc = AUTO;
    } else return;
    onChange(next);
  });
}
