// 특수 루트 공통 (룰북 12.1, 12.2, 12.7, 12.8) + 인플루언서(12.5) + 괴담(12.6)
// 패도는 fight.js, 내부고발자는 whistle.js
import { getState, save, nextRng, addMessage, count, checkTitles } from './state.js';
import { clamp } from './rng.js';
import { classById, transfer, placeById } from './school.js';
import { teacherStat, shiftMorale } from './turn.js';
import { yearTurn, yearOf } from './calendar.js';
import { TRAITS } from '../content/traits.js';
import { ROUTES, CONCEPTS, MYSTERIES, PUZZLES, ENDINGS, FIGHT_W, followerBonus } from '../content/routes.js';
import { HOMEROOM_ID, classLabel } from '../content/factions.js';

export function ensureRoutes(s) {
  s.routes ??= {};
  const r = s.routes;
  r.m ??= { pado: 0, whistle: 0, influencer: 0, ghost: 0 };
  r.pado ??= { unlocked: false, nextEvent: 7, boss: null, talks: 0, heat: 0, cover: 0, schoolBoss: false, last: null, fought: {} };
  r.whistle ??= { files: {}, counter: 0, last: null };
  r.inf ??= { unlocked: false, followers: 0, ctrv: 0, last: null };
  r.ghost ??= { unlocked: false, clues: {}, solved: [], puzzled: {}, madness: {}, last: null };
  r.fear ??= {};
  r.trustMark ??= s.trust;
  return r;
}

const fail = (msg) => ({ ok: false, msg });
const done = (msg) => { checkTitles(); save(); return { ok: true, msg }; };
export const gain = (s, key, v) => { s.routes.m[key] = clamp((s.routes.m[key] ?? 0) + v, 0, 100); };

// 정도 숙련도: 대결 4종과 교무 정치 실적으로 계산한다
export function justiceMastery(s) {
  const c = s.counters ?? {};
  return clamp((c.duelWin ?? 0) * 3 + (c.defendWin ?? 0) * 2 + (c.agendaPass ?? 0) * 4 + (c.examFirst ?? 0) * 4 + (c.electionWin ?? 0) * 4 + (c.post ?? 0) * 6 + (c.conquer ?? 0) * 6, 0, 100);
}
export const masteryOf = (s, key) => (key === 'justice' ? justiceMastery(s) : s.routes?.m?.[key] ?? 0);

// 지금 숙련도 상위 2개 루트로 정해지는 엔딩 (괴담은 엔딩과 따로)
export function endingOf(s) {
  const keys = ['justice', 'pado', 'whistle', 'influencer'].map((k) => [k, masteryOf(s, k)]).sort((a, b) => b[1] - a[1]);
  const [a, b] = keys;
  let text;
  if (a[1] < 20) text = '아직 정해지지 않음 (숙련도 20 이상인 루트가 없음)';
  else if (b[1] < 20) text = ENDINGS[a[0]] ?? `${ROUTES[a[0]].name} 단독`;
  else {
    const pair = [a[0], b[0]].sort().join('+');
    if (pair === 'justice+pado' && (a[1] < 80 || b[1] < 80)) text = `${ENDINGS[a[0]] ?? ROUTES[a[0]].name} (정도·패도 둘 다 정점이면 "전설의 선생님")`;
    else text = ENDINGS[pair] ?? ENDINGS[a[0]] ?? ROUTES[a[0]].name;
  }
  const trueEnd = s.routes?.ghost?.solved?.includes('thirteen');
  return { top: keys.slice(0, 2), text, trueEnd };
}

// 부상·정학·실종으로 빠진 학생
export const isOut = (s, st) => (st.outUntil ?? 0) > s.turn;
export const available = (s) => s.students.filter((st) => !isOut(s, st));
export const fightPower = (st) => Object.entries(FIGHT_W).reduce((a, [k, w]) => a + st.stats[k] * w, 0) / Object.values(FIGHT_W).reduce((a, w) => a + w, 0);

// ---------- 공포 지지도 (12.3) ----------

export function addFear(s, cls, amount, from) {
  const moved = transfer(cls, from ?? cls.owner, 'player', amount);
  s.routes.fear[cls.id] = (s.routes.fear[cls.id] ?? 0) + moved;
  return moved;
}
// 정도 대결 승리·상담·훈화로 공포 일부가 존경으로 바뀐다 (지지도는 그대로, 공포 몫만 줄어듦)
export function fearToRespect(s, classId, amount) {
  const f = s.routes?.fear?.[classId];
  if (f) s.routes.fear[classId] = Math.max(0, f - amount);
}

// ---------- 인플루언서 (12.5) ----------

export const BROADCAST_AP = 3, CONTENT_AP = 1, VIRAL_AP = 2, APOLOGY_AP = 1;

export function joinBroadcast() {
  const s = getState();
  const r = ensureRoutes(s);
  if (r.inf.unlocked) return fail('이미 방송부를 맡고 있습니다.');
  if (s.ap < BROADCAST_AP) return fail(`AP가 부족합니다 (필요 ${BROADCAST_AP}).`);
  s.ap -= BROADCAST_AP;
  const p = clamp(0.3 + (teacherStat('정치력') - 10) * 0.04, 0.1, 0.8);
  if (nextRng().next() < p) {
    r.inf.unlocked = true;
    addMessage({ kind: 'info', title: '인플루언서 루트가 열렸습니다', body: '방송부 지도교사를 맡게 됐습니다. 학교 공식 채널로 콘텐츠를 올릴 수 있습니다.' });
    return done('방송부 지도교사가 됐습니다. 인플루언서 루트가 열렸습니다.');
  }
  return done('방송부 지도교사 자리를 얻지 못했습니다. 방송실을 차지하면 바로 열립니다.');
}

export function makeContent(castIds, concept) {
  const s = getState();
  const r = ensureRoutes(s);
  if (!r.inf.unlocked) return fail('인플루언서 루트가 아직 열리지 않았습니다.');
  const c = CONCEPTS[concept];
  if (!c) return fail('콘셉트를 골라 주세요.');
  if (c.ghost && !r.ghost.unlocked) return fail('아직 아무도 모르는 이야기입니다.');
  const cast = [...new Set(castIds)].map((id) => s.students.find((x) => x.id === id)).filter((x) => x && !isOut(s, x));
  if (cast.length < 2 || cast.length > 3) return fail('출연 학생을 2~3명 골라 주세요.');
  if (s.ap < CONTENT_AP) return fail(`AP가 부족합니다 (필요 ${CONTENT_AP}).`);
  s.ap -= CONTENT_AP;
  const rng = nextRng();
  const charm = cast.reduce((a, st) => a + st.stats['친화력'] + st.stats['창의성'] + st.stats['기행'] * 0.5, 0) / cast.length / 25;
  let views = 800 * charm * c.mult * (1 + r.inf.followers / 8000) * (0.6 + rng.next());
  if (cast.some((st) => st.trait === '인플루언서')) views *= 2;
  views = Math.round(views);
  const follow = Math.round(views * 0.02);
  r.inf.followers += follow;
  r.inf.ctrv = clamp(r.inf.ctrv + c.ctrv, 0, 100);
  for (const st of cast) st.fameExp += Math.round(views / 100);
  if (c.parents) s.trust = clamp(s.trust + 1, 0, 100);
  if (c.ghost) for (const st of cast) r.ghost.madness[st.id] = clamp((r.ghost.madness[st.id] ?? 0) + 5, 0, 100);
  gain(s, 'influencer', 2);
  let extra = '';
  // 논란 60 이상이면 콘텐츠마다 20% 확률로 논란 폭발
  if (r.inf.ctrv >= 60 && rng.next() < 0.2) extra = blowUp(s, cast);
  r.inf.last = `${c.name} 콘텐츠: 조회수 ${views.toLocaleString()} · 팔로워 +${follow}${extra}`;
  count('content');
  return done(r.inf.last);
}

function blowUp(s, cast) {
  const r = s.routes;
  r.inf.followers = Math.round(r.inf.followers * 0.7);
  s.trust = clamp(s.trust - 10, 0, 100);
  for (const st of cast) shiftMorale(st, -2);
  addMessage({ kind: 'warn', title: '논란이 터졌습니다', body: '학교 채널 영상이 논란이 됐습니다. 팔로워 -30%, 학부모 민원 2건(교장 신임 -10), 출연 학생 사기 -2단계.' });
  return ' · 논란 폭발!';
}

export function viral(classId) {
  const s = getState();
  const r = ensureRoutes(s);
  if (!r.inf.unlocked) return fail('인플루언서 루트가 아직 열리지 않았습니다.');
  const cls = classById(s, classId);
  if (!cls || cls.id === HOMEROOM_ID) return fail('다른 반을 골라 주세요.');
  if (s.ap < VIRAL_AP) return fail(`AP가 부족합니다 (필요 ${VIRAL_AP}).`);
  s.ap -= VIRAL_AP;
  const amount = Math.min(15, r.inf.followers / 1000);
  const moved = transfer(cls, 'others', 'player', amount);
  r.inf.ctrv = clamp(r.inf.ctrv + 5, 0, 100);
  gain(s, 'influencer', 3);
  r.inf.last = `${classLabel(classId)} 바이럴: 우리 지지도 +${moved.toFixed(1)}%p`;
  return done(r.inf.last);
}

export function apology() {
  const s = getState();
  const r = ensureRoutes(s);
  if (!r.inf.unlocked) return fail('인플루언서 루트가 아직 열리지 않았습니다.');
  if (s.ap < APOLOGY_AP) return fail(`AP가 부족합니다 (필요 ${APOLOGY_AP}).`);
  s.ap -= APOLOGY_AP;
  const speaker = [...available(s)].sort((a, b) => b.stats['언어력'] - a.stats['언어력'])[0];
  const ok = nextRng().next() < clamp(speaker.stats['언어력'] * 0.05 + (s.profile.subject === 'korean' ? 0.1 : 0), 0.1, 0.95);
  r.inf.ctrv = clamp(r.inf.ctrv + (ok ? -20 : 10), 0, 100);
  r.inf.last = ok ? `${speaker.name}의 해명 영상이 통했습니다. 논란 -20.` : `${speaker.name}의 해명 영상이 오히려 불을 붙였습니다. 논란 +10.`;
  return done(r.inf.last);
}

// 팔로워에 따른 일상 영향력 보너스 (%)
export const influencerBonus = (s) => (s.routes?.inf?.unlocked ? followerBonus(s.routes.inf.followers) : 0);

// ---------- 괴담 (12.6) ----------

export const INVESTIGATE_AP = 1;
export const solved = (s, id) => !!s.routes?.ghost?.solved?.includes(id);

export function investigate(mysteryId, studentIds) {
  const s = getState();
  const r = ensureRoutes(s);
  if (!r.ghost.unlocked) return fail('아직 아무것도 모릅니다.');
  const my = MYSTERIES.find((x) => x.id === mysteryId);
  if (!my || solved(s, mysteryId)) return fail('조사할 수 없는 괴담입니다.');
  if (my.last && r.ghost.solved.length < 6) return fail('앞의 6개를 먼저 풀어야 나타납니다.');
  const max = r.m.ghost >= 50 ? 3 : 2;
  const team = [...new Set(studentIds)].map((id) => s.students.find((x) => x.id === id)).filter((x) => x && !isOut(s, x));
  if (team.length < 1 || team.length > max) return fail(`조사할 학생을 1~${max}명 골라 주세요.`);
  if (s.ap < INVESTIGATE_AP) return fail(`AP가 부족합니다 (필요 ${INVESTIGATE_AP}).`);
  s.ap -= INVESTIGATE_AP;
  let clue = team.reduce((a, st) => a + (st.stats['논리력'] + st.stats['기억력']) / 4, 0);
  if (r.m.ghost >= 80) clue *= 1.5;
  clue = Math.round(clue);
  r.ghost.clues[my.id] = (r.ghost.clues[my.id] ?? 0) + clue;
  for (const st of team) r.ghost.madness[st.id] = clamp((r.ghost.madness[st.id] ?? 0) + Math.round(20 - st.stats['평정심'] * 0.5), 0, 100);
  gain(s, 'ghost', 3);
  let msg = `${my.name}: 단서 +${clue} (${Math.min(r.ghost.clues[my.id], my.need)}/${my.need})`;
  if (r.ghost.clues[my.id] >= my.need / 2 && !r.ghost.puzzled[my.id] && r.ghost.clues[my.id] < my.need) {
    r.ghost.puzzled[my.id] = true;
    const [text, a, b] = PUZZLES[my.id];
    addMessage({ kind: 'event', title: `괴담: ${my.name}`, body: text, ref: {}, ghost: my.id, investigators: team.map((x) => x.id),
      choices: [{ key: 'a', label: a, desc: '단서 +12, 조사한 학생 광기 +10' }, { key: 'b', label: b, desc: '단서 +5' }] });
    msg += ' · 이상한 일이 생겼습니다. 받은 편지함을 보세요.';
  }
  if (r.ghost.clues[my.id] >= my.need) msg += solveMystery(s, my);
  r.ghost.last = msg;
  return done(msg);
}

function solveMystery(s, my) {
  const r = s.routes;
  if (r.ghost.solved.includes(my.id)) return '';
  r.ghost.solved.push(my.id);
  gain(s, 'ghost', 10);
  count('mystery');
  addMessage({ kind: 'info', title: `괴담 해결: ${my.name}`, body: `${my.reward}${my.last ? '' : ' (영구)'}.${r.ghost.solved.length === 6 ? '\n복도 끝에 처음 보는 문이 생겼습니다. 13번째 교실입니다.' : ''}` });
  return ` · 해결! ${my.reward}`;
}

export function answerPuzzle(s, m, choice) {
  const r = ensureRoutes(s);
  const my = MYSTERIES.find((x) => x.id === m.ghost);
  r.ghost.clues[my.id] = (r.ghost.clues[my.id] ?? 0) + (choice === 'a' ? 12 : 5);
  if (choice === 'a') for (const id of m.investigators ?? []) r.ghost.madness[id] = clamp((r.ghost.madness[id] ?? 0) + 10, 0, 100);
  let msg = `단서 +${choice === 'a' ? 12 : 5}`;
  if (r.ghost.clues[my.id] >= my.need) msg += solveMystery(s, my);
  return msg;
}

// 괴담 보상: 성장 배율 (turn.js 성장 단계에서 쓴다)
export function ghostGrowth(s, k) {
  let v = 1;
  if (solved(s, 'piano') && k === '창의성') v *= 1.2;
  if (solved(s, 'library') && (k === '기억력' || k === '이해력')) v *= 1.15;
  if (solved(s, 'basement') && ['체력', '피지컬', '운동신경', '격투', '맷집'].includes(k)) v *= 1.15;
  return v;
}

// ---------- 주말 정산 ----------

export function routesWeekly(s, rng) {
  const r = ensureRoutes(s);
  const t = yearTurn(s.turn);

  // 패도 해금: "옥상의 싸움" (6턴 뒤, 첫 학기 동안 매주 15%, 싸움 잘하는 학생이 있으면 30%)
  if (!r.pado.unlocked && yearOf(s.turn) === 0 && t > 6 && t <= 20 && s.turn >= r.pado.nextEvent && !s.inbox.some((m) => m.rooftop && !m.resolved)) {
    const tough = s.students.some((st) => st.stats['격투'] >= 12 || st.trait === '트러블 메이커' || st.trait === '헬창');
    if (rng.next() < (tough ? 0.3 : 0.15)) {
      const [a, b] = [...available(s)].sort((x, y) => fightPower(y) - fightPower(x));
      if (a && b) addMessage({ kind: 'event', title: '옥상의 싸움', ref: {}, rooftop: [a.id, b.id],
        body: `점심시간, 옥상에서 ${a.name}과(와) ${b.name}이(가) 서로 물러서지 않고 맞서 있습니다. 둘 다 스스로 나선 싸움입니다. 어떻게 할까요?`,
        choices: [{ key: 'stop', label: '말린다', desc: '아무 일도 없던 걸로' }, { key: 'ignore', label: '모른 척한다', desc: '못 본 걸로' }, { key: 'watch', label: '지켜본다', desc: '이긴 학생이 첫 짱 후보가 된다 (패도 루트)' }] });
    }
  }

  // 열기: 매주 -3 (학생부장이면 -6)
  r.pado.heat = Math.max(0, r.pado.heat - (placeById(s, 'discipline')?.owner === 'player' ? 6 : 3));

  // 공포 지지도: 매주 -2%p (학교 짱이면 절반). 공포 비중 70% 이상인 우리 반은 5% 확률로 반란
  for (const [id, f] of Object.entries(r.fear)) {
    if (f <= 0) continue;
    const cls = classById(s, id);
    if (!cls) continue;
    const dec = Math.min(f, r.pado.schoolBoss ? 1 : 2);
    transfer(cls, 'player', 'none', dec, false);
    r.fear[id] = f - dec;
    if (cls.owner === 'player' && cls.support.player > 0 && r.fear[id] / cls.support.player >= 0.7 && rng.next() < 0.05) {
      const half = r.fear[id] / 2;
      transfer(cls, 'player', 'none', half, false);
      r.fear[id] -= half;
      addMessage({ kind: 'warn', title: `${classLabel(id)}에서 반란이 일어났습니다`, body: `공포로만 묶여 있던 반이 들고일어났습니다. 우리 지지도 -${half.toFixed(1)}%p. 공포로 얻은 반은 정도(대결 승리, 상담)로 안정시켜야 합니다.` });
    }
  }

  // 내부고발자: 의심은 매주 -2, 숙련 50이면 익명 제보함 (진행 중인 사건 증거 +3%p)
  for (const f of Object.values(r.whistle.files)) {
    f.suspicion = Math.max(0, (f.suspicion ?? 0) - 2);
    if (r.m.whistle >= 50 && f.known) for (const sin of f.sins ?? []) f.evidence[sin] = Math.min(100, (f.evidence[sin] ?? 0) + 3);
  }

  // 인플루언서: 방송실을 차지하면 열림, 논란 매주 -3
  if (!r.inf.unlocked && placeById(s, 'broadcast')?.owner === 'player') {
    r.inf.unlocked = true;
    addMessage({ kind: 'info', title: '인플루언서 루트가 열렸습니다', body: '방송실을 차지했습니다. 학교 공식 채널로 콘텐츠를 올릴 수 있습니다.' });
  }
  r.inf.ctrv = Math.max(0, r.inf.ctrv - 3);

  // 괴담: 기행 15 이상인 학생이 야자 시간에 2% 확률로 이상한 일을 겪으면 열림
  if (!r.ghost.unlocked) {
    const odd = s.students.find((st) => st.stats['기행'] >= 15 && rng.next() < 0.02);
    if (odd) {
      r.ghost.unlocked = true;
      addMessage({ kind: 'info', title: '이 학교에는 7대 불가사의가 있다', body: `야간 자율학습 중 ${odd.name}이(가) 아무도 없는 음악실에서 피아노 소리를 들었다고 합니다. 선배들 사이에 전해지는 "한일고 7대 불가사의"가 진짜일지도 모릅니다. (괴담 루트가 열렸습니다)` });
    }
  }
  // 광기: 매주 -3, 50 이상이면 사기가 흔들리고, 100이면 실종 (4주 뒤 돌아오고 성향이 바뀜)
  for (const st of s.students) {
    const m = r.ghost.madness[st.id] ?? 0;
    if (!m) continue;
    if (m >= 100 && !isOut(s, st)) {
      st.outUntil = s.turn + 4;
      st.outWhy = '실종';
      st.trait = rng.pick(TRAITS).name;
      r.ghost.madness[st.id] = 60;
      addMessage({ kind: 'warn', title: `${st.name}이(가) 사라졌습니다`, body: '괴담을 조사하던 학생이 연락이 닿지 않습니다. 4주 뒤 돌아오지만, 무언가 달라져 있을 겁니다.' });
      continue;
    }
    if (m >= 50 && rng.next() < 0.3) shiftMorale(st, rng.next() < 0.5 ? 1 : -1);
    r.ghost.madness[st.id] = Math.max(0, m - 3);
  }

  // 교장실 초상화: 이번 주 교장 신임 하락폭 -25%
  if (solved(s, 'portrait') && s.trust < r.trustMark) s.trust = clamp(s.trust + Math.round((r.trustMark - s.trust) * 0.25), 0, 100);

  // 부상·정학·실종에서 돌아온 학생
  for (const st of s.students) if (st.outUntil && st.outUntil === s.turn + 1) addMessage({ kind: 'info', title: `${st.name} 복귀`, body: `${st.outWhy ?? '부상'}에서 돌아왔습니다.` });
}

// 주말 정산이 끝난 뒤 다음 주 기준 신임을 기록
export function markTrust(s) { if (s.routes) s.routes.trustMark = s.trust; }

