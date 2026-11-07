// 게임 상태와 세이브 슬롯 3개. 모두 이 브라우저의 localStorage에 저장한다.
import { makeRng } from './rng.js';
import { makeHomeroom } from './students.js';
import { weekLabel } from './calendar.js';
import { subjectByKey, BASE_TEACHER } from '../content/subjects.js';
import { TITLES } from '../content/titles.js';
import { makeSchool, extraTiles } from './school.js';
import { applyPersona } from './persona.js';

export const SLOT_COUNT = 3;
const VERSION = 4;
const slotKey = (n) => `hanil-manager-slot-${n}`;
const META_KEY = 'hanil-manager-meta';
const OLD_KEY = 'hanil-manager-save-v1';

let state = null;
let slot = null;

function read(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function remove(key) { try { localStorage.removeItem(key); } catch { /* 무시 */ } }

// 예전 버전 세이브를 지금 형식으로 맞춘다.
function upgrade(s) {
  const rng = makeRng(s.seed + 77);
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
  s.counters ??= {};
  s.profile ??= { name: '이름 없는', subject: null, title: TITLES[0].name, titles: [TITLES[0].name] };
  s.school ??= makeSchool(s.seed, s.profile.name);
  if (!s.school.places) Object.assign(s.school, extraTiles());
  s.duel ??= null;
  for (const st of s.students) {
    st.prog ??= {};
    st.focus ??= null;
    st.lastCounsel ??= 0;
    st.calmUntil ??= 0;
  }
  s.weekLabel = weekLabel(s.turn);
  s.version = VERSION;
  return s;
}

// 첫 실행 때 예전 단일 세이브를 1번 칸으로 옮긴다.
export function migrateOldSave() {
  const old = read(OLD_KEY);
  if (old && !read(slotKey(1))) { write(slotKey(1), upgrade(old)); write(META_KEY, { lastSlot: 1 }); }
  if (old) remove(OLD_KEY);
}

export function summarize(s) {
  const subject = subjectByKey(s.profile?.subject);
  return {
    name: s.profile?.name ?? '이름 없는',
    title: s.profile?.title ?? '',
    subject: subject ? subject.name : '과목 없음',
    week: weekLabel(s.turn),
    className: s.className,
    savedAt: s.savedAt ?? null,
  };
}

export function listSlots() {
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const s = read(slotKey(i + 1));
    return { n: i + 1, summary: s ? summarize(s) : null };
  });
}

export const hasAnySave = () => listSlots().some((x) => x.summary);

export function lastSlot() {
  const meta = read(META_KEY);
  if (meta?.lastSlot && read(slotKey(meta.lastSlot))) return meta.lastSlot;
  return listSlots().find((x) => x.summary)?.n ?? null;
}

export function loadSlot(n) {
  const s = read(slotKey(n));
  if (!s || !Array.isArray(s.students)) return false;
  state = upgrade(s);
  slot = n;
  write(META_KEY, { lastSlot: n });
  return true;
}

export function deleteSlot(n) {
  remove(slotKey(n));
  if (slot === n) { state = null; slot = null; }
}

export const exportSlot = (n) => JSON.stringify(read(slotKey(n)));

export function importSlot(n, text) {
  let s;
  try { s = JSON.parse(text); } catch { return '파일을 읽을 수 없습니다. 한일고 매니저 세이브 파일이 맞는지 확인해 주세요.'; }
  if (!s || !Array.isArray(s.students) || typeof s.turn !== 'number') return '한일고 매니저 세이브 파일이 아닙니다.';
  if (!write(slotKey(n), upgrade(s))) return '저장 공간이 부족해서 불러오지 못했습니다.';
  return null;
}

export const isPlaying = () => state !== null;
export const currentSlot = () => slot;

export function quitToTitle() { save(); state = null; slot = null; }

// 새 게임: 프로필(이름, 과목, 칭호)로 교사를 만들고 담임반을 생성한다.
export function newGame({ name, subject, title, slotN, persona = null, seed = Math.floor(Math.random() * 1e9) }) {
  const rng = makeRng(seed);
  const sub = subjectByKey(subject);
  const teacher = { ...BASE_TEACHER };
  if (sub) teacher[sub.bonus] += 2;
  state = upgrade({
    version: VERSION,
    seed,
    rngStep: 0,
    turn: 1,
    className: '1학년 4반',
    teacher,
    freeObservations: 3,
    students: makeHomeroom(rng),
    profile: { name, subject, title, titles: [TITLES[0].name] },
  });
  slot = slotN;
  if (persona) applyPersona(state, persona, { start: true });
  addMessage({
    kind: 'info',
    title: `입학식: ${name} 선생님, 1학년 4반 담임이 되었습니다`,
    body: `담당 과목은 ${sub ? sub.name : '없음'}입니다 (${sub ? `${sub.bonus} +2` : ''}). 담임반 30명이 배정됐고, 이번 주만 학생 관찰이 3번 무료입니다. 숨은 원석이 한 명 있으니 잘 찾아보세요. 첫 학기 목표는 담임반 지지도 70% 이상과 반 1개 추가 점령입니다.`,
  });
  write(META_KEY, { lastSlot: slotN });
  save();
  return state;
}

export function getState() { return state; }

export function save() {
  if (!state || !slot) return;
  state.savedAt = Date.now();
  write(slotKey(slot), state);
}

export function studentById(id) { return state.students.find((s) => s.id === id); }

// 판정마다 다른 난수를 쓰도록 시드를 한 칸씩 민다.
export function nextRng() {
  return makeRng(state.seed * 31 + 1000 + (++state.rngStep));
}

export function addMessage(msg) {
  state.inbox.unshift({ id: `m${++state.msgSeq}`, turn: state.turn, read: false, ...msg });
  if (state.inbox.length > 120) state.inbox.length = 120;
}

export function count(key, by = 1) { state.counters[key] = (state.counters[key] ?? 0) + by; }

// 새로 조건을 채운 칭호를 얻는다.
export function checkTitles() {
  const got = [];
  for (const t of TITLES) {
    if (!state.profile.titles.includes(t.name) && t.check(state)) { state.profile.titles.push(t.name); got.push(t.name); }
  }
  for (const name of got) {
    addMessage({ kind: 'info', title: `새 칭호를 얻었습니다: ${name}`, body: `프로필에서 칭호를 "${name}"(으)로 바꿀 수 있습니다.` });
  }
  return got;
}

export function setTitle(name) {
  if (state.profile.titles.includes(name)) { state.profile.title = name; save(); }
}

export const unreadCount = () => state.inbox.filter((m) => !m.read || (m.choices && !m.resolved)).length;
export const pendingDecisions = () => state.inbox.filter((m) => m.choices && !m.resolved);
