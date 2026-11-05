// 게임 상태: 이 브라우저의 localStorage에 저장한다.
import { makeRng } from './rng.js';
import { makeHomeroom } from './students.js';
import { weekLabel } from './calendar.js';

const KEY = 'hanil-manager-save-v1';
const VERSION = 2;
let state = null;

// 버전 2에서 생긴 값들 (턴 진행)
function addTurnFields(s, rng) {
  s.ap ??= 5;
  s.apMax ??= 5;
  s.overtime ??= 0;
  s.fatigue ??= 0;
  s.budget ??= 30;
  s.trust ??= 50;
  s.training ??= { intel: 40, body: 40, rest: 20 };
  s.warden ??= { strict: rng.int(6, 16), mood: '보통', relation: 40 };
  s.inbox ??= [];
  s.usedThisWeek ??= {};
  s.caught ??= {};
  s.msgSeq ??= 0;
  for (const st of s.students) {
    st.prog ??= {};
    st.focus ??= null;
    st.lastCounsel ??= 0;
    st.calmUntil ??= 0;
  }
  s.weekLabel = weekLabel(s.turn);
  s.version = VERSION;
}

export function newGame(seed = Math.floor(Math.random() * 1e9)) {
  const rng = makeRng(seed);
  state = {
    version: VERSION,
    seed,
    rngStep: 0,
    turn: 1,
    className: '1학년 4반',
    // 플레이어 만들기 화면이 생기기 전까지 쓰는 임시 교사 (능력치 8 + 10포인트)
    teacher: { 지도력: 10, 교과전문성: 9, 상담: 9, 동기부여: 9, 안목: 10, 행정력: 9, 정치력: 10 },
    freeObservations: 3,
    students: makeHomeroom(rng),
  };
  addTurnFields(state, rng);
  addMessage({
    kind: 'info',
    title: '입학식: 1학년 4반 담임이 되었습니다',
    body: '담임반 30명이 배정됐습니다. 이번 주만 학생 관찰이 3번 무료입니다. 숨은 원석이 한 명 있으니 잘 찾아보세요. 첫 학기 목표는 담임반 지지도 70% 이상과 반 1개 추가 점령입니다.',
  });
  save();
  return state;
}

export function getState() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version === 1 || saved.version === VERSION) {
        state = saved;
        if (saved.version === 1) addTurnFields(state, makeRng(saved.seed + 77));
        return state;
      }
    }
  } catch { /* 저장소를 못 쓰는 환경이면 새로 시작한다 */ }
  return newGame();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 실패해도 진행은 된다 */ }
}

export function studentById(id) { return getState().students.find((s) => s.id === id); }

// 판정마다 다른 난수를 쓰도록 시드를 한 칸씩 민다.
export function nextRng() {
  const s = getState();
  return makeRng(s.seed * 31 + 1000 + (++s.rngStep));
}

export function addMessage(msg) {
  const s = state;
  s.inbox.unshift({ id: `m${++s.msgSeq}`, turn: s.turn, read: false, ...msg });
  if (s.inbox.length > 120) s.inbox.length = 120;
}

export const unreadCount = () => getState().inbox.filter((m) => !m.read || (m.choices && !m.resolved)).length;
export const pendingDecisions = () => getState().inbox.filter((m) => m.choices && !m.resolved);
