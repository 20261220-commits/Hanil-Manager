// 기능을 단계적으로 열기 (입문 도우미): 처음엔 기본 화면만 보이고, 때가 되면 멘토가 새 기능을 소개하며 연다.
// 예전 세이브와 "모든 기능 처음부터 열기"를 고른 게임은 처음부터 다 열려 있다.
import { getState, save } from './state.js';
import { nextExamTurn } from './exam.js';

const owned = (s) => s.school.classes.filter((c) => c.owner === 'player').length;

export const FEATURES = {
  school: {
    name: '교내 판도', href: '#school', how: '2주째에 열립니다.',
    when: (s) => s.turn >= 2,
    intro: ['새 기능이 열렸어요: "교내 판도". 학교 반 24개의 주인과 지지도를 한눈에 볼 수 있어요.',
      '다른 반에 대결을 걸어 이기면 지지도를 가져오고, 50%를 넘기면 그 반을 점령해요. 대결은 3월 3주부터 걸 수 있어요.'],
  },
  office: {
    name: '교무실', href: '#office', how: '한 달(4주)이 지나면 열립니다.',
    when: (s) => s.turn >= 4,
    intro: ['새 기능이 열렸어요: "교무실". 매달 마지막 주에 교무회의가 열려요.',
      '안건을 올려 특별실이나 학교 규칙을 가져오고, 다른 선생님을 우리 계파로 데려오거나 동맹을 맺을 수 있어요.'],
  },
  exam: {
    name: '시험', href: '#exam', how: '첫 시험 2주 전에 열립니다.',
    when: (s) => nextExamTurn(s.turn) - s.turn <= 2 || s.turn >= 8,
    intro: ['새 기능이 열렸어요: "시험". 곧 중간고사예요.',
      '시험 결과는 반 순위와 지지도에 영향을 줘요. 시험 전에는 지적 훈련 비율을 높여 두세요.'],
  },
  ops: {
    name: '공작', href: '#school', how: '반을 2개 점령하거나 10주가 지나면 열립니다.',
    when: (s) => owned(s) >= 2 || s.turn >= 10,
    intro: ['새 기능이 열렸어요: "공작". 교내 판도의 반마다 "공작" 버튼이 생겼어요.',
      '그 반 학생을 우리 편으로 포섭하거나 소문을 퍼뜨려 지지도를 흔들 수 있어요. 들키면 교장 신임이 떨어지니 조심하세요.'],
  },
  routes: {
    name: '특수 루트', href: '#routes', how: '12주가 지나거나 반을 3개 점령하면 열립니다.',
    when: (s) => s.turn >= 12 || owned(s) >= 3,
    intro: ['새 기능이 열렸어요: "특수 루트". 대결 말고도 학교를 장악하는 다른 길이 있어요.',
      '싸움, 내부고발, 학교 SNS, 괴담 조사 같은 길이에요. 조건을 채우면 하나씩 열려요.'],
  },
};
export const FEATURE_KEYS = Object.keys(FEATURES);

export function ensureUnlock(s) {
  if (!s.unlocked) {
    // 예전 세이브(이미 진행한 게임)는 모두 열어 둔다
    s.unlocked = {};
    if (s.turn > 1) for (const k of FEATURE_KEYS) s.unlocked[k] = s.turn;
  }
  return s.unlocked;
}

export const isOpen = (s, key) => !FEATURES[key] || !!s.unlockAll || !!s.unlocked?.[key];

// 주가 바뀔 때: 조건을 채운 기능을 열고, 멘토가 소개할 목록에 넣는다
export function unlockWeekly(s) {
  ensureUnlock(s);
  const fresh = [];
  for (const k of FEATURE_KEYS) {
    if (isOpen(s, k)) continue;
    if (FEATURES[k].when(s)) { s.unlocked[k] = s.turn; fresh.push(k); }
  }
  return fresh;
}

// 이번 주에 새로 열린 기능
export const newlyOpened = (s) => (s.unlockAll ? [] : FEATURE_KEYS.filter((k) => s.unlocked?.[k] === s.turn && s.turn > 1));

export function openAll() {
  const s = getState();
  s.unlockAll = true;
  save();
  return { ok: true, msg: '모든 기능을 열었습니다.' };
}

// 주소(#...)가 어느 기능에 속하는지
export function featureOfHash(hash) {
  if (hash === 'school' || /^duel-\d/.test(hash)) return 'school';
  if (hash.startsWith('ops-')) return 'ops';
  if (['office', 'exam', 'routes'].includes(hash)) return hash;
  return null;
}
