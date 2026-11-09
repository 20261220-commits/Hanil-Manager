// 시험 대결 (룰북 9.9): 반 전체가 3일 동안 시험을 본다. 4주 전에 고른 대비 전략이 핵심이다.
import { getState, save, nextRng, addMessage, count, checkTitles } from './state.js';
import { makeRng, clamp } from './rng.js';
import { rosterOf, transfer, placeById, MORALE_MULT } from './school.js';
import { condMult } from './match.js';
import { teacherStat, shiftMorale } from './turn.js';
import { calcCA } from './students.js';
import { MORALE } from '../content/stats.js';
import { HOMEROOM_ID, classLabel } from '../content/factions.js';

export const EXAM_SUBJECTS = {
  국어: { 언어력: 3, 이해력: 2, 논리력: 1 },
  영어: { 언어력: 2, 기억력: 2, 이해력: 2 },
  수학: { 수리력: 3, 논리력: 2, 문제해결력: 2 },
  탐구: { 이해력: 2, 기억력: 2, 논리력: 1 },
  암기: { 기억력: 3, 집중력: 1 },
};
export const EXAM_DAYS = [['국어', '영어'], ['수학', '탐구'], ['암기']];
export const STRATEGIES = {
  balance: { name: '균형 학습', desc: '보너스 없음. 가장 안정적' },
  focus: { name: '주력 과목', desc: '수학·영어 +8점, 나머지 과목 -4점' },
  cram: { name: '벼락치기', desc: '전 과목 +(기억력 - 10) × 1.2점, 시험 시작 컨디션 -15%' },
  bottom: { name: '하위권 집중', desc: '반 하위 30% 학생만 전 과목 +10점' },
};
export const NIGHT = {
  sleep: { name: '일찍 자라', desc: '다음 날 컨디션 +10' },
  review: { name: '마지막 정리', desc: '다음 날 점수 +4, 컨디션 -10' },
};
// 담당 과목이 그 시험 과목이면 교사 보정 +0.05 (과목의 "강한 대결")
const SUBJECT_EXAM = { korean: '국어', english: '영어', math: '수학', social: '탐구', science: '탐구', history: '암기' };

// 시험 주차: 1학기 중간 8, 기말 17 · 2학기 중간 31, 기말 39 (해마다 48턴씩)
const EXAM_TURNS = [8, 17, 31, 39];
export function nextExamTurn(turn) {
  for (let y = 0; y < 10; y++) for (const t of EXAM_TURNS) if (t + y * 48 >= turn) return t + y * 48;
  return null;
}
export const examName = (t) => ({ 0: '1학기 중간고사', 1: '1학기 기말고사', 2: '2학기 중간고사', 3: '2학기 기말고사' })[EXAM_TURNS.indexOf(((t - 1) % 48) + 1)] ?? '시험';
export const PREP_WEEKS = 4;

// 출제 경향: 시험마다 어려운 과목 하나 (전 반 -8점). 연구부장이면 미리 알고, 우리 반은 그 과목 +4점
export const hardSubjectOf = (s, examTurn) => Object.keys(EXAM_SUBJECTS)[Math.abs(s.seed + examTurn * 17) % 5];
export const hasResearch = (s) => placeById(s, 'research')?.owner === 'player';

// 다가오는 시험 상태. 지난 시험은 그 주가 끝나면 다음 시험으로 바뀐다.
export function ensureExam(s) {
  if (!s.exam || s.exam.turn < s.turn) {
    s.exam = { turn: nextExamTurn(s.turn), strategy: 'balance', chosenAt: null, day: 0, finished: false, results: null, night: 'sleep', coach: null };
  }
  return s.exam;
}

export const inPrepWindow = (s, e) => s.turn >= e.turn - PREP_WEEKS && s.turn < e.turn;
export const isExamWeek = (s, e) => s.turn === e.turn && !e.finished;

const fail = (msg) => ({ ok: false, msg });
const done = (msg) => { checkTitles(); save(); return { ok: true, msg }; };

export function chooseStrategy(key) {
  const s = getState();
  const e = ensureExam(s);
  if (!STRATEGIES[key]) return fail('없는 전략입니다.');
  if (!inPrepWindow(s, e)) return fail(s.turn >= e.turn ? '시험 주간에는 전략을 바꿀 수 없습니다.' : `대비 전략은 시험 ${PREP_WEEKS}주 전부터 고를 수 있습니다.`);
  e.strategy = key;
  e.chosenAt = s.turn;
  return done(`${examName(e.turn)} 대비 전략: ${STRATEGIES[key].name}`);
}

// ---------- 점수 계산 ----------

const LUCK_P = { 빨: [0.01, 0.06], 주: [0.02, 0.04], 노: [0.03, 0.03], 연: [0.04, 0.02], 초: [0.06, 0.01] };

function subjectAbility(st, subj) {
  const w = EXAM_SUBJECTS[subj];
  let sum = 0, tw = 0;
  for (const k in w) { sum += st.stats[k] * w[k]; tw += w[k]; }
  return sum / tw;
}

// 학생 한 명의 하루 점수 (과목별)
function dayScores(st, subjects, ctx, rng) {
  const out = {};
  const moraleM = MORALE_MULT[Math.max(0, MORALE.indexOf(st.morale))] ?? 1;
  const [good, bad] = LUCK_P[st.luck] ?? LUCK_P.노;
  const r = rng.next();
  const luck = r < good ? 5 : r < good + bad * (1 - st.stats['메타인지'] * 0.03) ? -8 : 0;
  for (const subj of subjects) {
    let ab = subjectAbility(st, subj) * condMult(ctx.cond(st)) * moraleM * (ctx.teacher[subj] ?? 1);
    let score = (25 + ((ab - 1) / 19) * 75) * (0.85 + st.stats['집중력'] * 0.0075);
    score += (rng.next() * 2 - 1) * 8 + luck + (ctx.bonus(st, subj) ?? 0);
    if (subj === ctx.hard) score -= 8;
    out[subj] = clamp(Math.round(score), 0, 100);
  }
  return out;
}

function strategyBonus(strategy, roster) {
  const cut = [...roster].sort((a, b) => calcCA(a.stats) - calcCA(b.stats))[Math.floor(roster.length * 0.3)];
  const low = new Set(roster.filter((st) => calcCA(st.stats) <= calcCA(cut.stats)).map((st) => st.id));
  return (st, subj) => {
    if (strategy === 'focus') return subj === '수학' || subj === '영어' ? 8 : -4;
    if (strategy === 'cram') return (st.stats['기억력'] - 10) * 1.2;
    if (strategy === 'bottom') return low.has(st.id) ? 10 : 0;
    return 0;
  };
}

// 우리 반을 뺀 같은 학년 반들의 대비 전략 (입시파 반은 주력 과목이나 하위권 집중)
const aiStrategy = (cls, rng) => (cls.owner === 'exam' ? rng.pick(['focus', 'bottom']) : rng.next() < 0.6 ? 'balance' : rng.pick(['focus', 'cram', 'bottom']));

// 같은 학년 반 전체의 하루 시험을 치른다 (우리 반 포함)
function runDay(s, e, rng) {
  const grade = 1;
  const day = e.day;
  const subjects = EXAM_DAYS[day];
  const hard = hardSubjectOf(s, e.turn);
  e.results ??= { classes: {}, students: {}, log: [] };
  const R = e.results;
  for (const cls of s.school.classes.filter((c) => c.grade === grade)) {
    const ours = cls.id === HOMEROOM_ID;
    const roster = ours ? s.students : rosterOf(s, cls);
    const cr = (R.classes[cls.id] ??= { total: 0, days: [], strategy: ours ? e.strategy : aiStrategy(cls, makeRng(cls.seed + e.turn)) });
    const bonusOf = strategyBonus(cr.strategy, roster);
    const nightBonus = ours && day > 0 && e.lastNight === 'review' ? 4 : 0;
    const teacher = {};
    if (ours) {
      const subj = SUBJECT_EXAM[s.profile.subject];
      if (subj) teacher[subj] = 1.05;
      teacher.all = 1 + (teacherStat('교과전문성') - 10) * 0.005;
      for (const k of Object.keys(EXAM_SUBJECTS)) teacher[k] = (teacher[k] ?? 1) * teacher.all;
    }
    const ctx = {
      hard,
      teacher,
      cond: (st) => (ours ? st.condition : 90 - (cr.strategy === 'cram' && day === 0 ? 15 : 0)),
      bonus: (st, subj) => bonusOf(st, subj) + nightBonus + (ours && e.coachHit === st.id ? 6 : 0) + (ours && hasResearch(s) && subj === hard ? 4 : 0),
    };
    const mood = rng.gauss() * 8; // 그날 반 분위기 (표준편차 8점)
    let sum = 0;
    for (const st of roster) {
      const sc = dayScores(st, subjects, ctx, rng);
      const key = `${cls.id}:${st.id}`;
      const rec = (R.students[key] ??= { name: st.name, classId: cls.id, id: st.id, total: 0, subjects: {} });
      for (const [k, v] of Object.entries(sc)) { rec.subjects[k] = v; rec.total += v; }
      sum += Object.values(sc).reduce((a, x) => a + x, 0) / subjects.length;
    }
    const dayAvg = sum / roster.length + mood;
    cr.days.push(Math.round(dayAvg * 10) / 10);
    cr.total = Math.round(cr.days.reduce((a, x) => a + x, 0) / cr.days.length * 10) / 10;
    if (ours) {
      for (const st of s.students) st.condition = clamp(st.condition - 5, 30, 100);
    }
  }
  e.coachHit = null;
  e.day++;
}

// 시험 시작 (1일차 전): 벼락치기면 컨디션 -15
function startExam(s, e) {
  if (e.started) return;
  e.started = true;
  if (e.strategy === 'cram') for (const st of s.students) st.condition = clamp(st.condition - 15, 30, 100);
}

export function examDay() {
  const s = getState();
  const e = ensureExam(s);
  if (!isExamWeek(s, e)) return fail('시험 주간이 아닙니다.');
  startExam(s, e);
  // 지난밤 지시 적용
  if (e.day > 0) {
    if (e.night === 'sleep') for (const st of s.students) st.condition = clamp(st.condition + 10, 30, 100);
    if (e.night === 'review') for (const st of s.students) st.condition = clamp(st.condition - 10, 30, 100);
    e.lastNight = e.night;
  }
  runDay(s, e, nextRng());
  if (e.day >= EXAM_DAYS.length) finishExam(s, e, nextRng());
  save();
  return { ok: true, msg: e.finished ? '시험이 끝났습니다.' : `${e.day}일차 시험이 끝났습니다.` };
}

export function setNight(key) {
  const s = getState();
  const e = ensureExam(s);
  if (!NIGHT[key]) return fail('없는 지시입니다.');
  e.night = key;
  save();
  return { ok: true, msg: `오늘 밤: ${NIGHT[key].name}` };
}

// 개별 지시 1회 (훈화와 같은 규칙): 성공하면 그 학생 다음 날 +6점
export function coachStudent(id) {
  const s = getState();
  const e = ensureExam(s);
  if (!isExamWeek(s, e) || e.day === 0 || e.day >= EXAM_DAYS.length) return fail('시험일 사이에만 할 수 있습니다.');
  if (e.coach) return fail('개별 지시는 시험마다 한 번입니다.');
  const st = s.students.find((x) => x.id === id);
  if (!st) return fail('없는 학생입니다.');
  e.coach = id;
  const ok = nextRng().next() < 0.4 + teacherStat('동기부여') * 0.025;
  if (ok) e.coachHit = id;
  save();
  return { ok: true, msg: ok ? `${st.name}에게 따로 한마디 했습니다. 내일 시험에 힘이 될 겁니다.` : `${st.name}에게 한마디 했지만 별로 와닿지 않은 것 같습니다.` };
}

function finishExam(s, e, rng) {
  e.finished = true;
  const R = e.results;
  const ranking = Object.entries(R.classes).sort((a, b) => b[1].total - a[1].total).map(([id, v], i) => ({ id, ...v, rank: i + 1 }));
  R.ranking = ranking;
  const home = ranking.find((r) => r.id === HOMEROOM_ID);
  const homeCls = s.school.classes.find((c) => c.id === HOMEROOM_ID);
  // 지지도: 학년 반 순위에 비례 (담임반: 1등 +5.3%p ~ 8등 -5.3%p, 다른 반: 순위 차 × 0.6%p)
  const homeDelta = (4.5 - home.rank) * 1.5;
  if (homeDelta > 0) transfer(homeCls, 'others', 'player', homeDelta); else transfer(homeCls, 'player', 'none', -homeDelta, false);
  const changes = [];
  for (const r of ranking) {
    if (r.id === HOMEROOM_ID) continue;
    const cls = s.school.classes.find((c) => c.id === r.id);
    const d = clamp((r.rank - home.rank) * 0.6, -4, 4);
    if (d > 0 && cls.owner !== 'player') transfer(cls, cls.owner, 'player', d);
    else if (d < 0) transfer(cls, 'player', cls.owner === 'player' ? 'none' : cls.owner, -d, false);
    if (Math.abs(d) >= 0.6) changes.push(`${classLabel(r.id)} ${d > 0 ? '+' : ''}${d.toFixed(1)}`);
  }
  // 학년 1~3등 학생: 명성 경험치 대량
  const top = Object.values(R.students).sort((a, b) => b.total - a.total).slice(0, 3);
  R.top = top;
  for (const t of top) {
    if (t.classId !== HOMEROOM_ID) continue;
    const st = s.students.find((x) => x.id === t.id);
    if (st) { st.fameExp += 150; shiftMorale(st, 1); }
  }
  // 시험이 끝나면 성적 불안이 풀리고, 결과에 따라 반 분위기가 바뀐다
  for (const st of s.students) {
    st.needs.grade = Math.max(0, st.needs.grade - 40);
    if (home.rank <= 3 && rng.next() < 0.5) shiftMorale(st, 1);
    if (home.rank >= 6 && rng.next() < 0.3) shiftMorale(st, -1);
  }
  if (home.rank === 1) count('examFirst');
  R.homeRank = home.rank;
  R.homeDelta = homeDelta;
  addMessage({
    kind: home.rank <= 3 ? 'info' : 'report',
    title: `${examName(e.turn)} 결과: 1학년 ${home.rank}등 (평균 ${home.total}점)`,
    body: [
      `대비 전략: ${STRATEGIES[e.strategy].name} · 어려운 과목: ${hardSubjectOf(s, e.turn)}`,
      `1학년 반 순위: ${ranking.map((r) => `${r.rank}. ${classLabel(r.id)} ${r.total}`).join(' / ')}`,
      `담임반 지지도 ${homeDelta > 0 ? '+' : ''}${homeDelta.toFixed(1)}%p${changes.length ? ` · 다른 반 우리 지지도: ${changes.join(', ')}` : ''}`,
      `학년 1~3등: ${top.map((t) => `${t.name}(${classLabel(t.classId)}, ${t.total}점)`).join(', ')}`,
    ].join('\n'),
  });
}

// 주말 정산: 시험 주인데 직접 안 치렀으면 자동으로 치른다
export function examWeekly(s, rng) {
  const e = ensureExam(s);
  if (s.turn !== e.turn || e.finished) return;
  startExam(s, e);
  while (e.day < EXAM_DAYS.length) {
    if (e.day > 0) { if (e.night === 'sleep') for (const st of s.students) st.condition = clamp(st.condition + 10, 30, 100); e.lastNight = e.night; }
    runDay(s, e, rng);
  }
  finishExam(s, e, rng);
}
