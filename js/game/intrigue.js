// 공작 (룰북 3.5, 8.3): 학생 포섭, 소문 퍼뜨리기, 동맹 협상. 학기 예산 수입 (3.6)
import { getState, save, nextRng, addMessage, count, checkTitles } from './state.js';
import { clamp } from './rng.js';
import { classById, rosterOf, transfer, placeById, playerClasses } from './school.js';
import { threat } from './ai.js';
import { postsOwned } from './politics.js';
import { FACTIONS, AI_FACTIONS, HOMEROOM_ID, classLabel } from '../content/factions.js';
import { FAME_STEPS, STATS } from '../content/stats.js';

const STAT_IDX_AFF = STATS.indexOf('친화력');

export const OPS_AP = 2;
export const ALLY_WEEKS = 8;
export const SCHOLARSHIP_MAX = 30;

export function ensureIntrigue(s) {
  const sc = s.school;
  sc.recruits ??= {};
  sc.allies ??= {};
  sc.opsLog ??= {};
  sc.goalOk ??= null;
}

const fail = (msg) => ({ ok: false, msg });
const done = (msg) => { checkTitles(); save(); return { ok: true, msg }; };
const topAvg = (list, f, n) => { const v = list.map(f).sort((a, b) => b - a).slice(0, n); return v.reduce((a, x) => a + x, 0) / v.length; };
const fameStarsOf = (st) => FAME_STEPS.filter((x) => st.fameExp >= x).length;
const usedThisWeek = (s, key) => s.school.opsLog[key] === s.turn;

// ---------- 학생 포섭 (2 AP) ----------

// 우리 반의 영입력: 친화력이 높은 학생 5명 평균 + 명성
export function recruitPower(s) {
  return {
    aff: topAvg(s.students, (st) => st.stats['친화력'], 5),
    fame: s.students.reduce((a, st) => a + fameStarsOf(st), 0) / s.students.length,
  };
}

export function studentRecruitChance(s, cls, st, scholarship = 0) {
  const { aff, fame } = recruitPower(s);
  const owner = cls.owner;
  return clamp(0.25 + (aff - 9) * 0.04 + fame * 0.03 + (owner === 'none' ? 0.2 : 0)
    + (placeById(s, 'club')?.owner === 'player' ? 0.1 : 0) + (placeById(s, 'roof')?.owner === 'player' ? 0.05 : 0)
    + (s.routes?.ghost?.solved?.includes('roof') ? 0.1 : 0)
    - ((cls.support[owner] ?? 50) - 50) / 250 - (st.stats['자존감'] - 10) * 0.015 - (st.stats['통솔'] - 10) * 0.01
    + Math.min(SCHOLARSHIP_MAX, scholarship) / 100, 0.05, 0.9);
}

// 그 반의 우리 편 학생: 저장된 명단이 있으면 우리 계파 학생, 아니면 포섭 기록
export const recruitsOf = (s, classId) => {
  const stored = s.school.rosters?.[classId];
  if (stored) return stored.filter((c) => c.f === 'player').map((c) => ({ id: c.id, name: c.n, aff: c.s[STAT_IDX_AFF] }));
  return s.school.recruits[classId] ?? [];
};

export function opsBlock(s, cls) {
  if (!cls || cls.id === HOMEROOM_ID) return '우리 담임반입니다.';
  if (s.turn < 3) return '공작은 3월 3주부터 할 수 있습니다.';
  if (s.ap < OPS_AP) return `AP가 부족합니다 (필요 ${OPS_AP}).`;
  return null;
}

export function recruitStudent(classId, studentId, scholarship = 0) {
  const s = getState();
  const cls = classById(s, classId);
  const block = opsBlock(s, cls); if (block) return fail(block);
  if (cls.owner === 'player') return fail('이미 우리가 점령한 반입니다.');
  const st = rosterOf(s, cls).find((x) => x.id === studentId);
  if (!st) return fail('없는 학생입니다.');
  if (recruitsOf(s, classId).some((r) => r.id === studentId)) return fail('이미 우리 편인 학생입니다.');
  if (usedThisWeek(s, `stu:${classId}:${studentId}`)) return fail('이번 주에 이미 설득해 본 학생입니다.');
  const sch = clamp(Math.floor(scholarship / 10) * 10, 0, SCHOLARSHIP_MAX);
  if (s.budget < sch) return fail(`예산이 부족합니다 (장학금 ${sch}만원).`);
  s.ap -= OPS_AP;
  s.budget -= sch;
  s.school.opsLog[`stu:${classId}:${studentId}`] = s.turn;
  const p = studentRecruitChance(s, cls, st, sch);
  const owner = cls.owner;
  const rng = nextRng();
  if (rng.next() < p) {
    const stored = s.school.rosters?.[classId]?.find((c) => c.id === st.id);
    if (stored) stored.f = 'player';
    else (s.school.recruits[classId] ??= []).push({ id: st.id, name: st.name, aff: st.stats['친화력'], turn: s.turn });
    const gain = 2 + st.stats['친화력'] / 4;
    transfer(cls, owner, 'player', gain);
    if (AI_FACTIONS.includes(owner)) s.school.rel[owner] = clamp((s.school.rel[owner] ?? 0) - 5, -100, 100);
    count('studentRecruit');
    return done(`${classLabel(classId)} ${st.name}이(가) 우리 편이 됐습니다. 지지도 +${gain.toFixed(1)}%p, 앞으로 매주 친화력만큼 영향력을 퍼뜨립니다.${sch ? ` (장학금 ${sch}만원)` : ''}`);
  }
  if (AI_FACTIONS.includes(owner)) s.school.rel[owner] = clamp((s.school.rel[owner] ?? 0) - 10, -100, 100);
  return done(`${st.name}이(가) 넘어오지 않았습니다.${sch ? ` 장학금 ${sch}만원은 돌려받지 못했습니다.` : ''}${AI_FACTIONS.includes(owner) ? ` ${FACTIONS[owner].name}과(와) 사이가 나빠졌습니다.` : ''}`);
}

// ---------- 소문 퍼뜨리기 (2 AP) ----------

// 우리 반에서 말 잘하고 머리 잘 돌아가는 학생 3명 (언어력 + 창의성)
export function rumorPower(s) { return topAvg(s.students, (st) => (st.stats['언어력'] + st.stats['창의성']) / 2, 3); }
export function rumorPreview(s, cls, target) {
  const x = rumorPower(s);
  return {
    drop: clamp(Math.round((4 + (x - 10) * 0.6) * 10) / 10, 2, 10),
    caught: clamp(0.3 - (x - 10) * 0.02 - (target === 'none' ? 0.1 : 0), 0.08, 0.6),
  };
}

export function spreadRumor(classId, target) {
  const s = getState();
  const cls = classById(s, classId);
  const block = opsBlock(s, cls); if (block) return fail(block);
  if (!target || target === 'player' || !(cls.support[target] > 0.5)) return fail('그 반에서 지지도가 있는 상대 세력을 골라 주세요.');
  if (usedThisWeek(s, `rumor:${classId}`)) return fail('이번 주에 이 반에는 이미 소문을 냈습니다.');
  s.ap -= OPS_AP;
  s.school.opsLog[`rumor:${classId}`] = s.turn;
  const { drop, caught } = rumorPreview(s, cls, target);
  const rng = nextRng();
  const moved = transfer(cls, target, 'none', drop, false);
  count('rumor');
  if (rng.next() < caught) {
    s.trust = clamp(s.trust - 10, 0, 100);
    if (AI_FACTIONS.includes(target)) s.school.rel[target] = clamp((s.school.rel[target] ?? 0) - 20, -100, 100);
    for (const st of s.students) st.fameExp = Math.max(0, st.fameExp - 10);
    transfer(cls, 'player', 'none', 3, false);
    addMessage({ kind: 'warn', title: `소문의 출처가 들통났습니다: ${classLabel(classId)}`, body: `${FACTIONS[target].name}에 대한 소문을 우리가 퍼뜨렸다는 게 알려졌습니다. 교장 신임 -10, 담임반 명성 하락, 이 반의 우리 지지도 -3%p.${AI_FACTIONS.includes(target) ? ` ${FACTIONS[target].name}과(와) 사이가 크게 나빠졌습니다.` : ''}` });
    return done(`소문은 퍼졌지만(${FACTIONS[target].short} -${moved.toFixed(1)}%p) 출처가 들통났습니다. 신임 -10.`);
  }
  return done(`${classLabel(classId)}에 소문이 퍼졌습니다. ${FACTIONS[target].short} 지지도 -${moved.toFixed(1)}%p. 아무도 우리를 의심하지 않습니다.`);
}

// ---------- 동맹 협상 (2 AP) ----------

export const isAlly = (s, f) => (s.school.allies[f] ?? 0) > s.turn;

export function allyChance(s, f) {
  const rel = s.school.rel[f] ?? 0;
  const lead = topAvg(s.students, (st) => (st.stats['통솔'] + st.stats['의사결정']) / 2, 5);
  const commonEnemy = AI_FACTIONS.some((g) => g !== f && !s.school.ai?.gone?.[g] && (s.school.rel[g] ?? 0) <= -40);
  return clamp(0.3 + rel / 200 + (lead - 9) * 0.03 + (commonEnemy ? 0.2 : 0) + (f === 'innov' ? 0.1 : f === 'elder' ? -0.1 : 0)
    + (s.profile.subject === 'social' ? 0.1 : 0) - (threat(s).tier >= 2 ? 0.3 : 0), 0.05, 0.85);
}

export function allyBlock(s, f) {
  if (s.school.ai?.gone?.[f]) return '사라진 계파입니다.';
  if (isAlly(s, f)) return `이미 동맹입니다 (${s.school.allies[f] - s.turn}주 남음).`;
  if ((s.school.rel[f] ?? 0) <= -40) return '적대 관계라 협상 자리에 나오지 않습니다.';
  if (usedThisWeek(s, `ally:${f}`)) return '이번 주에 이미 협상했습니다.';
  if (s.ap < OPS_AP) return `AP가 부족합니다 (필요 ${OPS_AP}).`;
  return null;
}

export function negotiateAlliance(f) {
  const s = getState();
  const block = allyBlock(s, f); if (block) return fail(block);
  s.ap -= OPS_AP;
  s.school.opsLog[`ally:${f}`] = s.turn;
  const rng = nextRng();
  if (rng.next() < allyChance(s, f)) {
    s.school.allies[f] = s.turn + ALLY_WEEKS;
    s.school.rel[f] = clamp((s.school.rel[f] ?? 0) + 10, -100, 100);
    count('alliance');
    return done(`${FACTIONS[f].name}과(와) ${ALLY_WEEKS}주 동맹을 맺었습니다. 그동안 우리를 공격하지 않고, 교무회의에서 우리 안건 쪽으로 기웁니다.`);
  }
  s.school.rel[f] = clamp((s.school.rel[f] ?? 0) - 5, -100, 100);
  return done(`${FACTIONS[f].name}이(가) 동맹 제안을 거절했습니다.`);
}

// AI가 먼저 동맹을 제안했을 때 (받은 편지함)
export function answerAllianceOffer(s, m, choice) {
  const f = m.ally;
  if (choice === 'accept') {
    s.school.allies[f] = s.turn + ALLY_WEEKS;
    s.school.rel[f] = clamp((s.school.rel[f] ?? 0) + 10, -100, 100);
    count('alliance');
    return `${FACTIONS[f].name}과(와) ${ALLY_WEEKS}주 동맹을 맺었습니다.`;
  }
  s.school.rel[f] = clamp((s.school.rel[f] ?? 0) - 5, -100, 100);
  return `${FACTIONS[f].name}의 제안을 거절했습니다.`;
}

// ---------- 학기 예산 수입 (3.6) ----------

export function semesterIncome(s) {
  const owned = playerClasses(s).filter((c) => c.id !== HOMEROOM_ID).length;
  const posts = postsOwned(s).length;
  const lines = [
    ['담임반 학급운영비', 30],
    [`점령한 반 ${owned}개 (반당 10)`, owned * 10],
    [`부장 자리 업무추진비 ${posts}개 (자리당 20)`, posts * 20],
    ['동아리실(국사당) 점령', placeById(s, 'club')?.owner === 'player' ? 15 : 0],
    ['지난 학기 목표 달성 포상', s.school.goalOk ? 20 : 0],
  ];
  return { lines, total: lines.reduce((a, l) => a + l[1], 0) };
}

// 다음 수입이 들어오는 턴: 1학기 3월 1주(1턴), 2학기 8월 말(25턴), 다음 해 3월 …
export const nextIncomeTurn = (turn) => Math.floor((turn - 1) / 24) * 24 + 25;

// ---------- 주말 정산 ----------

export function intrigueWeekly(s, rng) {
  const sc = s.school;
  // 포섭한 학생들의 영향력: 1명당 (친화력 ÷ 20) × 0.5%p (8.2 일상 영향력)
  const classIds = new Set([...Object.keys(sc.recruits), ...Object.keys(sc.rosters ?? {})]);
  for (const classId of classIds) {
    if (classId === HOMEROOM_ID) continue;
    const cls = classById(s, classId);
    const list = recruitsOf(s, classId);
    if (!cls || !list.length) continue;
    transfer(cls, 'others', 'player', list.reduce((a, r) => a + (r.aff / 20) * 0.5, 0));
  }
  // 동맹: 배신 판정과 만료 (7.5). 우리 반 중 지지도 45% 미만이 있으면 배신 10%, 아니면 3%
  const weak = sc.classes.some((c) => c.owner === 'player' && c.support.player < 45);
  for (const f of AI_FACTIONS) {
    const until = sc.allies[f];
    if (!until) continue;
    if (until <= s.turn + 1) {
      delete sc.allies[f];
      addMessage({ kind: 'info', title: `${FACTIONS[f].name}과(와)의 동맹이 끝났습니다`, body: '교무실에서 다시 동맹을 협상할 수 있습니다.' });
    } else if (rng.next() < (weak ? 0.1 : 0.03)) {
      delete sc.allies[f];
      sc.rel[f] = Math.min(-60, (sc.rel[f] ?? 0) - 40);
      addMessage({ kind: 'warn', title: `${FACTIONS[f].name}이(가) 동맹을 깨고 등을 돌렸습니다`, body: '흔들리는 우리 반을 노리고 배신했습니다. 이제 적대 관계입니다.' });
    }
  }
  // AI의 동맹 제안: 혁신파가 가장 자주 (7.5). 관계가 10 이상인 계파만
  if (s.turn % 4 === 2) {
    const cands = AI_FACTIONS.filter((f) => !sc.ai?.gone?.[f] && !isAlly(s, f) && (sc.rel[f] ?? 0) >= 10);
    const f = cands.find((x) => x === 'innov') ?? cands[0];
    if (f && rng.next() < (f === 'innov' ? 0.5 : 0.25)) {
      addMessage({
        kind: 'event', title: `${FACTIONS[f].name}의 동맹 제안`, ref: {}, ally: f,
        body: `${FACTIONS[f].name}이(가) ${ALLY_WEEKS}주 동안 서로 공격하지 않고 교무회의에서 힘을 합치자고 제안합니다.`,
        choices: [{ key: 'accept', label: '받아들인다', desc: `${ALLY_WEEKS}주 동맹, 관계 +10` }, { key: 'decline', label: '거절한다', desc: '관계 -5' }],
      });
    }
  }
}

// 주말 정산 끝 (턴이 넘어간 뒤): 학기 초면 예산이 들어온다
export function incomeIfNewSemester(s) {
  if (s.turn <= 1 || (s.turn - 1) % 24 !== 0) return;
  const inc = semesterIncome(s);
  s.budget += inc.total;
  s.school.goalOk = null;
  addMessage({ kind: 'info', title: `새 학기 예산 +${inc.total}만원`, body: inc.lines.filter((l) => l[1]).map((l) => `${l[0]}: ${l[1]}만원`).join('\n') });
}
