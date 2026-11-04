// 게임 상태: 이 브라우저의 localStorage에 저장한다.
import { makeRng } from './rng.js';
import { makeHomeroom, observe } from './students.js';

const KEY = 'hanil-manager-save-v1';
let state = null;

export function newGame(seed = Math.floor(Math.random() * 1e9)) {
  const rng = makeRng(seed);
  state = {
    version: 1,
    seed,
    rngStep: 0,
    turn: 1,
    weekLabel: '3월 1주 (입학식)',
    className: '1학년 4반',
    // 플레이어 만들기 화면이 생기기 전까지 쓰는 임시 교사 (능력치 8 + 10포인트)
    teacher: { 지도력: 10, 교과전문성: 9, 상담: 9, 동기부여: 9, 안목: 10, 행정력: 9, 정치력: 10 },
    freeObservations: 3,
    students: makeHomeroom(rng),
  };
  save();
  return state;
}

export function getState() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version === 1) { state = saved; return state; }
    }
  } catch { /* 저장소를 못 쓰는 환경이면 새로 시작한다 */ }
  return newGame();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 실패해도 진행은 된다 */ }
}

export function studentById(id) { return getState().students.find((s) => s.id === id); }

// 입학식 주간에는 학생 관찰 3회가 무료 (룰북 8.0)
export function observeStudent(id) {
  const s = getState();
  const st = studentById(id);
  if (!st || st.observed || s.freeObservations <= 0) return false;
  const rng = makeRng(s.seed + 1000 + (++s.rngStep));
  observe(rng, st, s.teacher.안목);
  s.freeObservations -= 1;
  save();
  return true;
}
