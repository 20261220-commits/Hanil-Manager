// 학기 목표와 평가, 1막 종료(교장 추대), 게임 오버(전근 발령) (룰북 8.0, 8.4, 14장)
import { addMessage } from './state.js';
import { makeRng, clamp } from './rng.js';
import { classById, playerClasses, placeInfo } from './school.js';
import { yearTurn, weekLabel } from './calendar.js';
import { endingOf, masteryOf } from './routes.js';
import { HOMEROOM_ID } from '../content/factions.js';

// 1막 클리어에 필요한 타일: 반 24개 + 야외 구역 + 특별실 + 핵심실 (교장실·행정실은 마지막에 자동, 옥상·사택은 제외)
const NEEDED_KINDS = ['outdoor', 'special', 'core'];
export const neededPlaces = (s) => s.school.places.filter((p) => NEEDED_KINDS.includes(placeInfo(p.id).kind) && p.id !== 'principal');
const placesOwned = (s) => neededPlaces(s).filter((p) => p.owner === 'player').length;
const classesOwned = (s) => playerClasses(s).length;

// ---------- 학기 목표 ----------

const semesterOf = (turn) => Math.floor((turn - 1) / 24);
const finalExamTurn = (turn) => (yearTurn(turn) <= 24 ? 17 : 39) + Math.floor((turn - 1) / 48) * 48;

function makeGoal(s) {
  const sem = semesterOf(s.turn);
  const base = { sem, classes: classesOwned(s), places: placesOwned(s), set: s.turn };
  if (sem === 0) return { ...base, kind: 'first', text: '담임반 지지도 70% 이상 + 반 1개 추가 점령' };
  const rng = makeRng(s.seed * 7 + sem * 131);
  const kind = rng.weighted([['conquer', 3], ['support', 2], ['exam', 2], ['place', 2]]);
  if (kind === 'conquer') { const n = rng.int(1, 3); return { ...base, kind, n, text: `이번 학기 반 ${n}개 추가 장악` }; }
  if (kind === 'support') { const n = rng.pick([75, 80, 85]); return { ...base, kind, n, text: `담임반 지지도 ${n}% 이상` }; }
  if (kind === 'exam') { const n = rng.pick([2, 3]); return { ...base, kind, n, examTurn: finalExamTurn(s.turn), text: `기말고사 1학년 ${n}등 이내` }; }
  const n = rng.int(1, 2);
  return { ...base, kind, n, text: `특별실·야외 구역 ${n}곳 더 확보` };
}

export function ensureGoal(s) {
  if (!s.goal || s.goal.sem !== semesterOf(s.turn)) {
    s.goal = makeGoal(s);
    if (s.turn > 1) addMessage({ kind: 'info', title: `이번 학기 목표: ${s.goal.text}`, body: `교장 선생님이 이번 학기 목표를 정했습니다. 학기 말(${weekLabel(s.turn - yearTurn(s.turn) + (yearTurn(s.turn) <= 24 ? 20 : 40)).split(' (')[0]})에 평가합니다. 달성하면 교장 신임 +15와 다음 학기 포상 예산 20만원, 실패하면 신임 -20.` });
  }
  return s.goal;
}

export function goalProgress(s) {
  const g = ensureGoal(s);
  const home = classById(s, HOMEROOM_ID);
  if (g.kind === 'first') {
    const added = classesOwned(s) - g.classes;
    return { text: g.text, now: `담임반 ${Math.round(home.support.player)}% · 추가 점령 ${Math.max(0, added)}개`, ok: home.support.player >= 70 && added >= 1 };
  }
  if (g.kind === 'conquer') { const added = classesOwned(s) - g.classes; return { text: g.text, now: `추가 장악 ${Math.max(0, added)} / ${g.n}`, ok: added >= g.n }; }
  if (g.kind === 'support') return { text: g.text, now: `지금 ${Math.round(home.support.player)}%`, ok: home.support.player >= g.n };
  if (g.kind === 'exam') {
    const rec = (s.examHistory ?? []).find((r) => r.turn === g.examTurn);
    return { text: g.text, now: rec ? `기말 ${rec.rank}등` : '기말고사 전', ok: !!rec && rec.rank <= g.n };
  }
  const added = placesOwned(s) - g.places;
  return { text: g.text, now: `추가 확보 ${Math.max(0, added)} / ${g.n}`, ok: added >= g.n };
}

// 학기 말 평가 (1학기 20턴, 2학기 40턴): 달성 +15, 실패 -20 (14장)
export function evaluateSemester(s) {
  const t = yearTurn(s.turn);
  if (t !== 20 && t !== 40) return;
  const p = goalProgress(s);
  s.trust = clamp(s.trust + (p.ok ? 15 : -20), 0, 100);
  s.school.goalOk = p.ok;
  addMessage({ kind: p.ok ? 'info' : 'warn', title: `${t === 20 ? '1학기' : '2학기'} 평가: ${p.ok ? '목표 달성' : '목표 미달'}`,
    body: `목표: ${p.text}\n결과: ${p.now}\n교장 신임 ${p.ok ? '+15, 다음 학기 포상 예산 20만원' : '-20'}.` });
}

// ---------- 1막 종료와 게임 오버 ----------

function summary(s) {
  const c = s.counters ?? {};
  return {
    turn: s.turn, week: weekLabel(s.turn), classes: classesOwned(s), places: placesOwned(s), trust: s.trust,
    duelWin: c.duelWin ?? 0, agendaPass: c.agendaPass ?? 0, fightWin: c.fightWin ?? 0, expose: c.expose ?? 0, mystery: c.mystery ?? 0,
    routes: ['justice', 'pado', 'whistle', 'influencer', 'ghost'].map((k) => [k, masteryOf(s, k)]),
    ending: endingOf(s),
  };
}

// 주말 정산 끝에서: 캠퍼스를 모두 점령했으면 교장 추대, 신임이 0이면 전근 발령
export function checkEnd(s) {
  if (s.gameOver || s.act1) return;
  if (s.trust <= 0) {
    s.gameOver = { reason: '전근 발령', ...summary(s) };
    addMessage({ kind: 'warn', title: '전근 발령', body: '교장 신임이 바닥났습니다. 교육청에서 다른 학교로 전근 발령이 났습니다.' });
    return;
  }
  const allClasses = s.school.classes.every((c) => c.owner === 'player');
  const allPlaces = neededPlaces(s).every((p) => p.owner === 'player');
  if (allClasses && allPlaces) {
    const principal = s.school.places.find((p) => p.id === 'principal');
    if (principal) principal.owner = 'player';
    s.act1 = { ...summary(s), seen: false };
    addMessage({ kind: 'info', title: '교장 추대', body: '캠퍼스의 모든 타일을 손에 넣었습니다. 교직원들이 만장일치로 교장으로 추대했습니다. 한일고가 본교가 됩니다.' });
  }
}

// 1막 클리어까지 남은 타일 (교내 판도·엔딩 화면 표시용)
export function conquestProgress(s) {
  const places = neededPlaces(s);
  return { classes: classesOwned(s), classTotal: s.school.classes.length, places: placesOwned(s), placeTotal: places.length };
}
