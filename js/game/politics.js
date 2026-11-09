// 교무실: 교무회의 안건, 표결, 사전 교섭, 교사 포섭, 부장 자리 (룰북 3.4, 3.5, 7.1, 7.4, 8.1, 8.3)
import { getState, save, nextRng, addMessage, count, checkTitles } from './state.js';
import { makeRng, clamp } from './rng.js';
import { placeById, placeInfo, classById, transfer } from './school.js';
import { teacherStat } from './turn.js';
import { threat } from './ai.js';
import { semesterOf } from './persona.js';
import { isAlly } from './intrigue.js';
import { SURNAMES, GIVEN } from '../content/names.js';
import { FACTIONS, AI_FACTIONS, classLabel } from '../content/factions.js';
import { SCHOOL_RULES, ruleById, POSTS, AGENDA_KIND, NOCONF_NEED } from '../content/council.js';

export const PROPOSE_AP = 2, LOBBY_AP = 1, RECRUIT_AP = 3;
const POST_IDS = Object.keys(POSTS);
const POLITICS_WEIGHT = { elder: 1.5, exam: 1.0, pe: 0.6, innov: 0.8 }; // 7.5 교무 정치 가중치

// 예전 세이브에도 교무실 상태를 채운다.
export function ensureCouncil(s) {
  const sc = s.school;
  const rng = makeRng(s.seed * 13 + 5);
  for (const c of sc.classes) {
    const t = c.teacher;
    t.id ??= `t-${c.id}`;
    t.classId = c.id;
    t.pol ??= t.faction === 'player' ? 0 : clamp(rng.int(7, 14) + (t.faction === 'elder' ? 2 : 0), 1, 20);
  }
  if (!sc.staff) {
    // 원로 교사는 6명인데 반은 4개라, 담임이 아닌 원로 2명이 교무부장·학생부장이다 (8.0)
    const used = new Set(sc.classes.map((c) => c.teacher.name));
    const name = () => { for (let i = 0; i < 50; i++) { const n = rng.weighted(SURNAMES) + rng.pick(GIVEN); if (!used.has(n)) { used.add(n); return n; } } return '홍길동'; };
    sc.staff = [
      { id: 't-s1', name: name(), faction: 'elder', lead: rng.int(9, 13), pol: rng.int(13, 16), classId: null },
      { id: 't-s2', name: name(), faction: 'elder', lead: rng.int(9, 13), pol: rng.int(12, 15), classId: null },
    ];
  }
  if (!sc.postHolder) {
    const examT = sc.classes.filter((c) => c.teacher.faction === 'exam').map((c) => c.teacher.id);
    sc.postHolder = { dean: 't-s1', discipline: 't-s2', research: examT[0] ?? null, career: examT[1] ?? null };
  }
  sc.rel ??= { elder: 0, exam: 0, pe: 0, innov: 0 };
  sc.rules ??= Object.fromEntries(SCHOOL_RULES.map((r) => [r.id, false]));
  sc.agenda ??= null;
  sc.council ??= { log: [], deanSem: null, budgetTurn: -99, recruited: {} };
}

export const allTeachers = (s) => [...s.school.classes.map((c) => c.teacher), ...s.school.staff];
export const teacherById = (s, id) => allTeachers(s).find((t) => t.id === id);
export const postsOwned = (s) => POST_IDS.filter((p) => placeById(s, p)?.owner === 'player');
export const apMaxFor = (s) => 5 + Math.min(2, postsOwned(s).length);
export const ruleOn = (s, id) => !!s.school.rules?.[id];
export const votesOf = (s) => {
  const out = {};
  for (const t of allTeachers(s)) out[t.faction] = (out[t.faction] ?? 0) + 1;
  return out;
};
export const holderName = (s, post) => {
  const h = s.school.postHolder[post];
  if (h === 'player') return `${s.profile.name} (나)`;
  return teacherById(s, h)?.name ?? '공석';
};

// ---------- 안건 ----------

// 안건 때문에 손해를 보는 계파 (그 계파는 무조건 반대)
function loserOf(s, a) {
  if (a.kind === 'room' || a.kind === 'noconf') return placeById(s, a.target)?.owner;
  return null;
}

function prefOf(s, f, a) {
  if (a.kind === 'rule') return (ruleById(a.target).pref[f] ?? 0) * (a.enact ? 1 : -1);
  if (a.kind === 'budget') return -0.1;
  return -0.08;
}

// 계파(또는 무소속 교사 한 명)가 찬성할 확률
export function yesChance(s, f, a) {
  if (f === a.proposer) return 1;
  if (f === loserOf(s, a)) return 0;
  let p = 0.45 + prefOf(s, f, a);
  if (a.proposer === 'player') {
    p += (teacherStat('정치력') - 10) * 0.03 + (s.profile.subject === 'social' ? 0.1 : 0);
    if (f !== 'none') p += (s.school.rel[f] ?? 0) / 250 - threat(s).tier * 0.07;
    if (a.lobbied?.[f]) p += 0.25;
    if (isAlly(s, f)) p += 0.2; // 동맹은 교무회의에서 우리 편으로 기운다
  }
  return clamp(p, 0.03, 0.97);
}

// 표결. playerStance: 'yes' | 'no' | 'abstain' (우리 계파 교사 전원)
export function tally(s, a, playerStance, rng) {
  const by = {};
  let yes = 0, no = 0, abstain = 0;
  const teachers = allTeachers(s);
  const blocs = {};
  for (const f of [...AI_FACTIONS]) blocs[f] = rng.next() < yesChance(s, f, a) ? 'yes' : 'no';
  for (const t of teachers) {
    let v;
    if (t.faction === 'player') v = playerStance;
    else if (t.faction === 'none') {
      if (a.proposer === 'none') v = 'yes';
      else v = rng.next() < 0.15 ? 'abstain' : rng.next() < yesChance(s, 'none', a) ? 'yes' : 'no';
    } else v = blocs[t.faction];
    by[t.faction] ??= { yes: 0, no: 0, abstain: 0 };
    by[t.faction][v]++;
    if (v === 'yes') yes++; else if (v === 'no') no++; else abstain++;
  }
  // 동수면 교장이 정한다: 플레이어 안건은 신임 50 이상이면 통과
  const tie = yes === no;
  const passed = tie ? (a.proposer === 'player' ? s.trust >= 50 : rng.next() < 0.5) : yes > no;
  return { yes, no, abstain, by, passed, tie };
}

// 예상 찬성표 (확률 기댓값)
export function expectedVotes(s, a, playerStance = 'yes') {
  let yes = 0, no = 0;
  for (const t of allTeachers(s)) {
    if (t.faction === 'player') { if (playerStance === 'yes') yes++; else if (playerStance === 'no') no++; continue; }
    const p = yesChance(s, t.faction, a) * (t.faction === 'none' ? 0.85 : 1);
    yes += p; no += (t.faction === 'none' ? 0.85 : 1) - p;
  }
  return { yes: Math.round(yes * 10) / 10, no: Math.round(no * 10) / 10, total: allTeachers(s).length };
}

export function agendaText(s, a) {
  if (a.kind === 'room') return `${placeInfo(a.target).name} 담당권을 ${FACTIONS[a.proposer].name}에게`;
  if (a.kind === 'rule') return `${ruleById(a.target).name} ${a.enact ? '도입' : '폐지'}`;
  if (a.kind === 'noconf') return `${POSTS[a.target].name} 불신임 (${FACTIONS[placeById(s, a.target).owner].name} → ${FACTIONS[a.proposer].name})`;
  return '담임반 학급 운영비 10만원 증액';
}

// 안건 발의 조건. 문제가 있으면 이유를 돌려준다.
export function proposeBlock(s, kind, target) {
  if (s.school.agenda) return '이번 주에 이미 올린 안건이 있습니다.';
  if (s.ap < PROPOSE_AP) return `AP가 부족합니다 (필요 ${PROPOSE_AP}).`;
  if (kind === 'room') {
    const p = placeById(s, target);
    if (!p || placeInfo(target).kind !== 'special') return '특별실을 골라 주세요.';
    if (p.owner === 'player') return '이미 우리 담당입니다.';
  }
  if (kind === 'noconf') {
    const p = placeById(s, target);
    if (!p || !POSTS[target]) return '부장 자리를 골라 주세요.';
    if (p.owner === 'player') return '이미 우리 자리입니다.';
    const owned = s.school.classes.filter((c) => c.owner === 'player').length;
    if (s.trust < NOCONF_NEED.trust) return `교장 신임 ${NOCONF_NEED.trust} 이상이어야 합니다 (지금 ${s.trust}).`;
    if (owned < NOCONF_NEED.classes && (s.counters.duelWin ?? 0) < NOCONF_NEED.wins) return `실적이 부족합니다: 반 ${NOCONF_NEED.classes}개 이상 또는 대결 ${NOCONF_NEED.wins}승 이상.`;
  }
  if (kind === 'rule' && !ruleById(target)) return '규칙을 골라 주세요.';
  if (kind === 'budget' && s.turn - s.school.council.budgetTurn < 8) return '운영비 증액은 8주에 한 번만 올릴 수 있습니다.';
  return null;
}

const fail = (msg) => ({ ok: false, msg });
const done = (msg) => { checkTitles(); save(); return { ok: true, msg }; };

export function propose(kind, target) {
  const s = getState();
  const block = proposeBlock(s, kind, target); if (block) return fail(block);
  s.ap -= PROPOSE_AP;
  const a = { kind, target: target ?? null, proposer: 'player', turn: s.turn, lobbied: {} };
  if (kind === 'rule') a.enact = !ruleOn(s, target);
  if (kind === 'budget') s.school.council.budgetTurn = s.turn;
  s.school.agenda = a;
  return done(`안건을 올렸습니다: ${agendaText(s, a)}. 이번 주말 교무회의에서 표결합니다.`);
}

export function lobby(f) {
  const s = getState();
  const a = s.school.agenda;
  if (!a) return fail('올린 안건이 없습니다.');
  if (a.lobbied[f]) return fail('이미 교섭한 계파입니다.');
  if (f === loserOf(s, a)) return fail('이 안건으로 손해를 보는 계파라 설득할 수 없습니다.');
  if (s.ap < LOBBY_AP) return fail(`AP가 부족합니다 (필요 ${LOBBY_AP}).`);
  s.ap -= LOBBY_AP;
  a.lobbied[f] = true;
  s.school.rel[f] = clamp((s.school.rel[f] ?? 0) + 3, -100, 100);
  return done(`${FACTIONS[f].name}과(와) 사전 교섭을 했습니다. 찬성할 가능성이 올라갔습니다.`);
}

export function cancelAgenda() {
  const s = getState();
  if (!s.school.agenda) return fail('올린 안건이 없습니다.');
  s.school.agenda = null;
  return done('안건을 거둬들였습니다. 쓴 AP는 돌아오지 않습니다.');
}

// 통과된 안건을 적용한다.
function applyAgenda(s, a) {
  if (a.kind === 'room') placeById(s, a.target).owner = a.proposer;
  if (a.kind === 'rule') s.school.rules[a.target] = a.enact;
  if (a.kind === 'budget') s.budget += 10;
  if (a.kind === 'noconf') {
    placeById(s, a.target).owner = a.proposer;
    s.school.postHolder[a.target] = a.proposer === 'player' ? 'player'
      : allTeachers(s).filter((t) => t.faction === a.proposer).sort((x, y) => y.pol - x.pol)[0]?.id ?? null;
    if (a.proposer === 'player') count('post');
  }
}

function voteLine(r) {
  const parts = Object.entries(r.by).map(([f, v]) => `${FACTIONS[f].short} ${v.yes}/${v.no}${v.abstain ? `/${v.abstain}` : ''}`);
  return `찬성 ${r.yes} · 반대 ${r.no}${r.abstain ? ` · 기권 ${r.abstain}` : ''}${r.tie ? ' (동수라 교장 결정)' : ''}\n계파별 찬성/반대: ${parts.join(', ')}`;
}

function logResult(s, a, r, text) {
  s.school.council.log.unshift({ turn: s.turn, text, proposer: a.proposer, passed: r.passed, yes: r.yes, no: r.no });
  s.school.council.log.length = Math.min(s.school.council.log.length, 30);
}

// 우리 안건 표결 (주말 정산)
function resolvePlayerAgenda(s, rng) {
  const a = s.school.agenda;
  if (!a) return;
  s.school.agenda = null;
  const loser = loserOf(s, a);
  const text = agendaText(s, a);
  const r = tally(s, a, 'yes', rng);
  if (r.passed) { applyAgenda(s, a); count('agendaPass'); }
  if (loser && loser !== 'none' && s.school.rel[loser] !== undefined) s.school.rel[loser] = clamp(s.school.rel[loser] - (r.passed ? 15 : 5), -100, 100);
  logResult(s, a, r, text);
  addMessage({
    kind: r.passed ? 'info' : 'report',
    title: `교무회의: "${text}" ${r.passed ? '통과' : '부결'}`,
    body: `${voteLine(r)}${r.passed ? `\n${effectLine(s, a)}` : ''}${loser && loser !== 'none' ? `\n${FACTIONS[loser].name}과(와)의 관계가 나빠졌습니다.` : ''}`,
  });
}

function effectLine(s, a) {
  if (a.kind === 'room') return `${placeInfo(a.target).name}을(를) 우리가 맡게 됐습니다. 효과: ${placeInfo(a.target).bonus}.`;
  if (a.kind === 'rule') return `${ruleById(a.target).name}이(가) ${a.enact ? '시행됩니다' : '폐지됐습니다'}. ${ruleById(a.target).desc}.`;
  if (a.kind === 'budget') return '예산 +10만원.';
  return `${POSTS[a.target].name} 자리를 맡게 됐습니다. ${POSTS[a.target].effect}. AP 최대치가 늘어납니다.`;
}

// AI 계파의 안건 (매달 마지막 주). 우리는 받은 편지함에서 찬반을 정한다.
function aiAgenda(s, rng) {
  const sc = s.school;
  const th = threat(s);
  const cands = [];
  for (const f of AI_FACTIONS) {
    if (sc.ai?.gone?.[f]) continue;
    const w = POLITICS_WEIGHT[f];
    for (const p of sc.places) {
      const info = placeInfo(p.id);
      if (p.owner === f) continue;
      if (isAlly(s, f) && p.owner === 'player') continue; // 동맹은 우리 자리를 노리지 않는다
      if (info.kind === 'special') cands.push({ w: w * (p.owner === 'player' ? th.mult * 1.5 : 1), a: { kind: 'room', target: p.id, proposer: f } });
      if (POSTS[p.id] && p.owner === 'player') cands.push({ w: w * 2 * th.mult, a: { kind: 'noconf', target: p.id, proposer: f } });
    }
    for (const r of SCHOOL_RULES) {
      const on = sc.rules[r.id];
      const pr = r.pref[f] ?? 0;
      if (!on && pr >= 0.15) cands.push({ w: w * pr * 4, a: { kind: 'rule', target: r.id, enact: true, proposer: f } });
      if (on && pr <= -0.15) cands.push({ w: w * -pr * 4, a: { kind: 'rule', target: r.id, enact: false, proposer: f } });
    }
  }
  if (!cands.length) return;
  const a = rng.weighted(cands.map((c) => [c.a, c.w]));
  a.turn = s.turn;
  const hurtsUs = loserOf(s, a) === 'player';
  const ex = expectedVotes(s, a, 'abstain');
  addMessage({
    kind: 'event',
    title: `교무회의 안건: ${agendaText(s, a)}`,
    body: `${FACTIONS[a.proposer].name}이(가) 안건을 올렸습니다.${a.kind === 'rule' ? ` (${ruleById(a.target).desc})` : ''}${hurtsUs ? '\n우리 자리를 빼앗으려는 안건입니다. 반대해야 합니다.' : ''}\n우리 계파 표: ${votesOf(s).player ?? 1}표 · 우리 표를 빼면 예상 찬성 ${ex.yes} / 반대 ${ex.no}`,
    ref: {},
    council: a,
    choices: [
      { key: 'yes', label: '찬성', desc: `${FACTIONS[a.proposer].name} 관계 +5` },
      { key: 'no', label: '반대', desc: `${FACTIONS[a.proposer].name} 관계 -5` },
      { key: 'abstain', label: '기권', desc: '관계 변화 없음' },
    ],
  });
}

// 받은 편지함에서 AI 안건에 표를 던졌을 때
export function voteOnAiAgenda(s, m, stance) {
  const a = m.council;
  const rng = nextRng();
  const text = agendaText(s, a);
  const r = tally(s, a, stance, rng);
  if (r.passed) applyAgenda(s, a);
  if (stance !== 'abstain') s.school.rel[a.proposer] = clamp((s.school.rel[a.proposer] ?? 0) + (stance === 'yes' ? 5 : -5), -100, 100);
  logResult(s, a, r, text);
  return `${r.passed ? '통과' : '부결'} — ${voteLine(r).replace('\n', ' · ')}`;
}

// ---------- 교사 포섭 (3 AP) ----------

export function recruitChance(s, t) {
  const rel = t.faction === 'none' ? 0 : s.school.rel[t.faction] ?? 0;
  return clamp(0.15 + (teacherStat('정치력') - 10) * 0.03 + (t.faction === 'none' ? 0.2 : 0) + rel / 300 - (t.pol - 10) * 0.02
    + (placeById(s, 'roof')?.owner === 'player' ? 0.05 : 0), 0.05, 0.8);
}

export function recruitBlock(s, t) {
  if (!t || t.faction === 'player') return '이미 우리 계파입니다.';
  if (s.ap < RECRUIT_AP) return `AP가 부족합니다 (필요 ${RECRUIT_AP}).`;
  if (s.school.council.recruited[t.id] === s.turn) return '이번 주에 이미 설득해 본 교사입니다.';
  return null;
}

export function recruitTeacher(id) {
  const s = getState();
  const t = teacherById(s, id);
  const block = recruitBlock(s, t); if (block) return fail(block);
  s.ap -= RECRUIT_AP;
  s.school.council.recruited[t.id] = s.turn;
  const from = t.faction;
  const rng = nextRng();
  if (rng.next() < recruitChance(s, t)) {
    t.faction = 'player';
    count('teacherRecruit');
    let extra = '';
    // 부장 자리를 가진 교사가 넘어오면 그 자리도 우리 것이 된다
    for (const post of POST_IDS) {
      if (s.school.postHolder[post] === t.id) { placeById(s, post).owner = 'player'; count('post'); extra += ` ${POSTS[post].name} 자리도 함께 넘어왔습니다!`; }
    }
    if (t.classId) {
      const cls = classById(s, t.classId);
      transfer(cls, 'others', 'player', 8);
      extra += ` ${classLabel(t.classId)}의 우리 지지도가 올랐습니다 (+8%p, 앞으로 매주 +1%p).`;
    }
    return done(`${t.name} 선생님이 우리 계파에 들어왔습니다 (${FACTIONS[from].name}에서).${extra}`);
  }
  if (from !== 'none') s.school.rel[from] = clamp((s.school.rel[from] ?? 0) - 30, -100, 100);
  return done(`${t.name} 선생님을 설득하지 못했습니다.${from !== 'none' ? ` ${FACTIONS[from].name}과(와) 사이가 크게 나빠졌습니다.` : ''}`);
}

// ---------- 교무부장: 담당 수업 반 고르기 ----------

export const canPickTeaching = (s) => placeById(s, 'dean')?.owner === 'player' && s.school.council.deanSem !== semesterOf(s.turn);

export function setTeaching(ids) {
  const s = getState();
  if (!canPickTeaching(s)) return fail('교무부장이어야 하고, 학기마다 한 번만 바꿀 수 있습니다.');
  const list = [...new Set(ids)].filter((id) => classById(s, id) && id !== '1-4');
  if (list.length !== 3) return fail('담임반을 뺀 반 3개를 골라 주세요.');
  s.school.teaching = list;
  s.school.council.deanSem = semesterOf(s.turn);
  return done(`담당 수업 반을 ${list.map(classLabel).join(', ')}(으)로 바꿨습니다.`);
}

// ---------- 주말 정산 ----------

export function councilWeekly(s, rng) {
  resolvePlayerAgenda(s, rng);
  // 매달 마지막 주(귀성 주)에 AI 계파가 안건을 올린다
  if (s.turn % 4 === 0 && s.turn >= 3) aiAgenda(s, rng);
  // 우리 계파 교사가 담임인 반은 매주 지지도 +1%p (흡수 교사 = 코치진, 7.4)
  for (const c of s.school.classes) if (c.teacher.faction === 'player' && c.id !== '1-4') transfer(c, 'others', 'player', 1);
  // 진로부장: 담임반 명성 경험치
  if (placeById(s, 'career')?.owner === 'player') for (const st of s.students) st.fameExp += 3;
  // 부장 자리에 따른 AP 최대치 (3.4)
  s.apMax = apMaxFor(s);
}
