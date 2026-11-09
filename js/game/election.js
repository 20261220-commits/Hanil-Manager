// 학급 임원(반장) 선거 (룰북 3.2 3월 2주, 8.2): 담임반에서 우리 쪽 후보와 무소속 후보가 맞붙는다.
// 선거 대결은 "중요 대결"이라 후보의 평정심(큰 경기 보정)이 표에 영향을 준다 (9.1, 9.2).
import { getState, save, nextRng, addMessage, count, checkTitles } from './state.js';
import { clamp } from './rng.js';
import { classById, transfer } from './school.js';
import { shiftMorale } from './turn.js';
import { HOMEROOM_ID } from '../content/factions.js';

export const ELECTION_TURN = 2;
export const CAMPAIGN = {
  speech: { name: '연설 지도', stats: ['언어력', '자존감'], desc: '후보의 언어력·자존감으로 연설을 다듬습니다' },
  pledge: { name: '공약 다듬기', stats: ['기획력', '창의성'], desc: '후보의 기획력·창의성으로 공약을 만듭니다' },
  persuade: { name: '친구들 설득', stats: ['친화력', '통솔'], desc: '후보의 친화력·통솔로 표를 모읍니다' },
};
export const CAMPAIGN_AP = 1;

const candPower = (st) => ((st.stats['통솔'] * 2 + st.stats['친화력'] * 2 + st.stats['언어력'] + st.stats['자존감']) / 6) * (1 + (st.stats['평정심'] - 10) * 0.01);

export function ensureElection(s) {
  if (s.election || s.turn > ELECTION_TURN) return s.election ?? null;
  const by = (k) => [...s.students].sort((a, b) => b.stats[k] - a.stats[k]);
  const ours = s.students.find((st) => st.tags.includes('leader')) ?? by('통솔')[0];
  const rival = [...s.students].filter((st) => st.id !== ours.id).sort((a, b) => candPower(b) - candPower(a))[0];
  s.election = { turn: ELECTION_TURN, candidate: ours.id, rival: rival.id, campaign: {}, done: false, result: null };
  return s.election;
}

export const electionOpen = (s) => !!s.election && !s.election.done && s.turn <= ELECTION_TURN;

const fail = (msg) => ({ ok: false, msg });
const done = (msg) => { checkTitles(); save(); return { ok: true, msg }; };

export function setCandidate(id) {
  const s = getState();
  const e = ensureElection(s);
  if (!electionOpen(s)) return fail('선거가 끝났습니다.');
  if (Object.keys(e.campaign).length) return fail('선거 운동을 시작한 뒤에는 후보를 바꿀 수 없습니다.');
  if (id === e.rival) return fail('무소속 후보로 나선 학생입니다.');
  if (!s.students.some((st) => st.id === id)) return fail('없는 학생입니다.');
  e.candidate = id;
  // 무소속 후보는 우리 후보를 뺀 학생 중 가장 강한 학생
  e.rival = [...s.students].filter((st) => st.id !== id).sort((a, b) => candPower(b) - candPower(a))[0].id;
  return done('우리 쪽 후보를 정했습니다.');
}

// 선거 운동 1회의 효과 (표심 %p): 후보의 해당 스탯 평균 - 7, 2~8
const campaignGain = (st, key) => clamp(CAMPAIGN[key].stats.reduce((a, k) => a + st.stats[k], 0) / 2 - 7, 2, 8);

export function campaign(key) {
  const s = getState();
  const e = ensureElection(s);
  if (!electionOpen(s)) return fail('선거 운동 기간이 아닙니다.');
  if (s.turn < ELECTION_TURN - 1) return fail('선거 운동은 입학식 주부터 할 수 있습니다.');
  if (!CAMPAIGN[key]) return fail('없는 선거 운동입니다.');
  if ((e.campaign[key] ?? 0) >= 2) return fail('같은 선거 운동은 두 번까지입니다.');
  if (s.ap < CAMPAIGN_AP) return fail(`AP가 부족합니다 (필요 ${CAMPAIGN_AP}).`);
  s.ap -= CAMPAIGN_AP;
  e.campaign[key] = (e.campaign[key] ?? 0) + 1;
  const st = s.students.find((x) => x.id === e.candidate);
  return done(`${CAMPAIGN[key].name}: 표심 +${(campaignGain(st, key) * (e.campaign[key] === 2 ? 0.5 : 1)).toFixed(1)}%p`);
}

// 학생 한 명이 우리 후보를 찍을 확률
function voteChance(s, e, st) {
  const home = classById(s, HOMEROOM_ID);
  const ours = s.students.find((x) => x.id === e.candidate), rival = s.students.find((x) => x.id === e.rival);
  let camp = 0;
  for (const [k, n] of Object.entries(e.campaign)) camp += campaignGain(ours, k) * (n >= 2 ? 1.5 : 1);
  return clamp(0.5 + (home.support.player - 50) / 125 + (candPower(ours) - candPower(rival)) * 0.04 + camp / 100 + (st.bond - 50) / 250, 0.05, 0.95);
}

export function expectedVotes(s) {
  const e = s.election;
  let ours = 1, rival = 1;
  for (const st of s.students) {
    if (st.id === e.candidate || st.id === e.rival) continue;
    const p = voteChance(s, e, st);
    ours += p; rival += 1 - p;
  }
  return { ours: Math.round(ours * 10) / 10, rival: Math.round(rival * 10) / 10 };
}

export const candidatePower = candPower;

// 주말 정산 (3월 2주): 개표
export function resolveElection(s, rng) {
  const e = s.election;
  if (!e || e.done || s.turn !== ELECTION_TURN) return;
  e.done = true;
  let ours = 1, rival = 1;
  for (const st of s.students) {
    if (st.id === e.candidate || st.id === e.rival) continue;
    if (rng.next() < voteChance(s, e, st)) ours++; else rival++;
  }
  const home = classById(s, HOMEROOM_ID);
  const cand = s.students.find((x) => x.id === e.candidate), riv = s.students.find((x) => x.id === e.rival);
  e.result = { ours, rival, win: ours > rival };
  if (ours > rival) {
    home.captain = 'player';
    transfer(home, 'others', 'player', 10);
    cand.tags = [...new Set([...cand.tags, 'captain'])];
    cand.fameExp += 80;
    shiftMorale(cand, 1);
    count('electionWin');
    addMessage({ kind: 'info', title: `반장 선거: ${cand.name} 당선 (${ours}:${rival})`, body: `우리 쪽 후보 ${cand.name}이(가) 1학년 4반 반장이 됐습니다. 담임반 지지도 +10%p, 앞으로 매주 +1%p.\n무소속 후보 ${riv.name}은(는) ${rival}표를 얻었습니다.` });
  } else {
    home.captain = 'none';
    shiftMorale(cand, -1);
    addMessage({ kind: 'info', title: `반장 선거: 낙선 (${ours}:${rival})`, body: `무소속 후보 ${riv.name}이(가) 반장이 됐습니다. 우리 쪽 후보 ${cand.name}은(는) 아쉽게 졌습니다.` });
  }
}
