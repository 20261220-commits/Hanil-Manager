// 교사 계파 (룰북 7.3, 7.5, 8.0). 인물은 모두 가상이다.
export const FACTIONS = {
  player: { name: '우리 계파', short: '우리', refuses: true },
  elder: { name: '원로 교사', short: '원로', refuses: true, favorite: '토론' },
  exam: { name: '입시파 부장', short: '입시', refuses: true, favorite: '시험' },
  pe: { name: '체육부장', short: '체육', refuses: true, favorite: '반 대항전' },
  innov: { name: '혁신파 교사', short: '혁신', refuses: true, favorite: '행사 기획' },
  none: { name: '무소속', short: '무소속', refuses: false },
  neutral: { name: '중립 (교장)', short: '중립', refuses: false },
};
// 지지도를 가지는 세력 (중립은 교장실·행정실 표시용)
export const FACTION_KEYS = ['player', 'elder', 'exam', 'pe', 'innov', 'none'];
export const AI_FACTIONS = ['elder', 'exam', 'pe', 'innov'];

// 학년별 반 주인 (8.0 초기 영토). 1학년 4반은 플레이어 담임반이고, 양옆 3·5반은 무소속이다.
export const START_OWNERS = {
  1: { fixed: { 3: 'none', 4: 'player', 5: 'none' }, rest: ['pe', 'pe', 'innov', 'innov', 'none'] },
  2: { fixed: {}, rest: ['exam', 'exam', 'exam', 'pe', 'pe', 'innov', 'innov', 'none'] },
  3: { fixed: {}, rest: ['elder', 'elder', 'elder', 'elder', 'exam', 'exam', 'innov', 'none'] },
};

export const HOMEROOM_ID = '1-4';
export const classLabel = (id) => { const [g, n] = id.split('-'); return `${g}학년 ${n}반`; };
