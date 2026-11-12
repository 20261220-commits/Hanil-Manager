// 패도 루트: 흑막 교사 (룰북 12.3). 싸움은 싸우겠다고 나선 학생끼리만 하고, 연출은 웹툰식으로만 한다.
import { getState, save, nextRng, addMessage, count, checkTitles } from './state.js';
import { clamp } from './rng.js';
import { classById, rosterOf, transfer } from './school.js';
import { shiftMorale } from './turn.js';
import { condMult } from './match.js';
import { MORALE_MULT } from './school.js';
import { MORALE } from '../content/stats.js';
import { FIGHT_TYPES, FORMATIONS, FIGHT_PLACES, FIGHT_LINES } from '../content/routes.js';
import { HOMEROOM_ID, classLabel } from '../content/factions.js';
import { ensureRoutes, gain, isOut, available, fightPower, addFear } from './routes.js';

export const TALK_AP = 1, COVER_AP = 2, TRAIN_AP = 1;
const fail = (msg) => ({ ok: false, msg });
const done = (msg) => { checkTitles(); save(); return { ok: true, msg }; };
const segWin = (r) => r ** 3.9 / (r ** 3.9 + 1);

export function answerRooftop(s, m, choice) {
  const r = ensureRoutes(s);
  if (choice !== 'watch') {
    r.pado.nextEvent = s.turn + 8;
    return choice === 'stop' ? '둘을 떼어 놓았습니다. 아무 일도 없던 걸로 했습니다.' : '못 본 척 지나갔습니다.';
  }
  const [a, b] = m.rooftop.map((id) => s.students.find((x) => x.id === id));
  if (!a || !b) return '둘 다 자리에 없습니다.';
  const rng = nextRng();
  const pa = fightPower(a), pb = fightPower(b);
  const winner = rng.next() < segWin(pa / pb) ? a : b;
  r.pado.unlocked = true;
  r.pado.boss = winner.id;
  winner.fameExp += 40;
  addMessage({ kind: 'info', title: '패도 루트가 열렸습니다', body: `옥상의 맞짱에서 ${winner.name}이(가) 이겼습니다. 소문이 퍼지고, ${winner.name}이(가) 1학년 4반의 짱 후보가 됐습니다.\n특수 루트 화면에서 짱과 밀담을 나눠야 싸움을 지시할 수 있습니다.` });
  return `${winner.name}이(가) 이겼습니다. 첫 짱 후보가 됐습니다.`;
}

export const boss = (s) => s.students.find((x) => x.id === s.routes?.pado?.boss) ?? null;

export function setBoss(id) {
  const s = getState();
  const r = ensureRoutes(s);
  if (!r.pado.unlocked) return fail('패도 루트가 아직 열리지 않았습니다.');
  const st = s.students.find((x) => x.id === id);
  if (!st) return fail('없는 학생입니다.');
  r.pado.boss = id;
  r.pado.talks = 0;
  return done(`${st.name}을(를) 짱으로 밀기로 했습니다. 밀담을 나눠 관계를 만들어 주세요.`);
}

// 짱과 밀담 (1 AP): 관계가 있어야 싸움을 지시할 수 있다
export function talkBoss() {
  const s = getState();
  const r = ensureRoutes(s);
  const b = boss(s);
  if (!r.pado.unlocked || !b) return fail('짱이 없습니다.');
  if (s.ap < TALK_AP) return fail(`AP가 부족합니다 (필요 ${TALK_AP}).`);
  s.ap -= TALK_AP;
  r.pado.talks++;
  b.bond = clamp(b.bond + 10, 0, 100);
  gain(s, 'pado', 1);
  return done(`${b.name}과(와) 조용히 이야기를 나눴습니다. 결속도 +10.`);
}

// 격투 특훈 (1 AP): 격투·맷집 집중 훈련 2주, 열기 +3
export function fightTraining(id) {
  const s = getState();
  const r = ensureRoutes(s);
  if (!r.pado.unlocked) return fail('패도 루트가 아직 열리지 않았습니다.');
  const st = s.students.find((x) => x.id === id);
  if (!st) return fail('없는 학생입니다.');
  if (s.ap < TRAIN_AP) return fail(`AP가 부족합니다 (필요 ${TRAIN_AP}).`);
  s.ap -= TRAIN_AP;
  st.focus = { stat: '격투', until: s.turn + 2 };
  r.pado.heat = clamp(r.pado.heat + (s.profile.subject === 'pe' ? 0 : 3), 0, 100);
  gain(s, 'pado', 1);
  return done(`${st.name}이(가) 2주 동안 격투 특훈을 합니다.${s.profile.subject === 'pe' ? ' (체육 교사라 열기가 오르지 않음)' : ' 열기 +3.'}`);
}

// 비호 (2 AP): 징계 1건 무마. 비호 기록이 남는다
export function cover(id) {
  const s = getState();
  const r = ensureRoutes(s);
  if (!r.pado.unlocked) return fail('패도 루트가 아직 열리지 않았습니다.');
  if (s.ap < COVER_AP) return fail(`AP가 부족합니다 (필요 ${COVER_AP}).`);
  const msg = s.inbox.find((m) => m.id === id && m.choices && !m.resolved && m.ref?.studentId);
  const st = msg ? null : s.students.find((x) => x.id === id && x.outWhy === '정학' && isOut(s, x));
  if (!msg && !st) return fail('무마할 징계가 없습니다.');
  s.ap -= COVER_AP;
  r.pado.cover++;
  gain(s, 'pado', 2);
  if (msg) {
    const who = s.students.find((x) => x.id === msg.ref.studentId);
    msg.resolved = 'cover'; msg.read = true; msg.result = '조용히 무마했습니다 (비호 기록 +1)';
    if (who) who.bond = clamp(who.bond + 15, 0, 100);
    return done(`${who?.name ?? '학생'}의 일을 조용히 덮었습니다. 비호 기록 +1.`);
  }
  st.outUntil = s.turn;
  st.outWhy = null;
  return done(`${st.name}의 정학을 무마했습니다. 비호 기록 +1.`);
}

// ---------- 싸움 ----------

const avgPower = (list) => list.reduce((a, st) => a + fightPower(st) * condMult(st.condition) * (MORALE_MULT[Math.max(0, MORALE.indexOf(st.morale))] ?? 1), 0) / list.length;
const pickLine = (rng, kind) => rng.pick(FIGHT_LINES[kind]);

// 싸움 상대: 반 짱 (그 반에서 가장 센 학생), 패싸움은 상위 5명, 전면전은 학교에서 가장 센 반의 상위 15명
export function enemyFor(s, type, classId) {
  if (type === 'war') {
    const best = s.school.classes.filter((c) => c.owner !== 'player').map((c) => ({ c, list: rosterOf(s, c).sort((a, b) => fightPower(b) - fightPower(a)) }))
      .sort((a, b) => avgPower(b.list.slice(0, 15)) - avgPower(a.list.slice(0, 15)))[0];
    return { cls: best.c, list: best.list.slice(0, 15) };
  }
  const cls = classById(s, classId);
  const list = rosterOf(s, cls).sort((a, b) => fightPower(b) - fightPower(a)).slice(0, FIGHT_TYPES[type].size);
  return { cls, list };
}

export function ourTeam(s, type) {
  const b = boss(s);
  const size = FIGHT_TYPES[type].size;
  const rest = available(s).filter((st) => st.id !== b?.id).sort((x, y) => fightPower(y) - fightPower(x));
  return b && !isOut(s, b) ? [b, ...rest].slice(0, size) : [];
}

export function fightBlock(s, type, classId) {
  const r = ensureRoutes(s);
  if (!r.pado.unlocked) return '패도 루트가 아직 열리지 않았습니다.';
  const b = boss(s);
  if (!b) return '짱이 없습니다. 짱으로 밀 학생을 정해 주세요.';
  if (isOut(s, b)) return `${b.name}이(가) 지금 나설 수 없습니다.`;
  if (!r.pado.talks) return '짱과 밀담을 먼저 나눠야 싸움을 지시할 수 있습니다.';
  if (FIGHT_TYPES[type].need && r.m.pado < FIGHT_TYPES[type].need) return `전면전은 패도 숙련 ${FIGHT_TYPES[type].need} 이상에서 열립니다.`;
  if (type !== 'war' && (!classById(s, classId) || classId === HOMEROOM_ID)) return '상대 반을 골라 주세요.';
  if (r.pado.fought[`${type}:${classId}`] === s.turn) return '이번 주에 이미 붙은 상대입니다.';
  if (s.turn < 3) return '3월 3주부터 할 수 있습니다.';
  if (s.ap < FIGHT_TYPES[type].ap) return `AP가 부족합니다 (필요 ${FIGHT_TYPES[type].ap}).`;
  return null;
}

export function orderFight({ type, classId, formation, place, video }) {
  const s = getState();
  const r = ensureRoutes(s);
  const block = fightBlock(s, type, classId); if (block) return fail(block);
  const T = FIGHT_TYPES[type], P = FIGHT_PLACES[place] ?? FIGHT_PLACES.back;
  if (!FORMATIONS[formation]) return fail('진형을 골라 주세요.');
  s.ap -= T.ap;
  r.pado.fought[`${type}:${classId}`] = s.turn;
  const rng = nextRng();
  const ours = ourTeam(s, type);
  const enemy = enemyFor(s, type, classId);
  const theirForm = rng.pick(Object.keys(FORMATIONS));
  const leaderCmd = (list) => 1 + (Math.max(...list.map((x) => x.stats['통솔'])) - 10) * (type === 'war' ? 0.02 : 0.01) * P.cmd;
  const formMult = FORMATIONS[formation] === theirForm ? 1.15 : FORMATIONS[theirForm] === formation ? 0.9 : 1;
  const numMult = (ours.length / enemy.list.length) ** (0.5 * P.num);
  const usPower = avgPower(ours) * (type === 'duel1' ? 1 : formMult * leaderCmd(ours) * numMult);
  const themPower = avgPower(enemy.list) * (type === 'duel1' ? 1 : leaderCmd(enemy.list));
  const log = [];
  const usName = type === 'duel1' ? ours[0].name : '우리 쪽', themName = type === 'duel1' ? enemy.list[0].name : `${classLabel(enemy.cls.id)} 쪽`;
  if (type !== 'duel1') log.push(`진형: 우리 ${formation} 대 상대 ${theirForm}${formMult > 1 ? ' (상성 유리)' : formMult < 1 ? ' (상성 불리)' : ''} · 장소 ${P.name}`);
  let w = 0, l = 0;
  for (let round = 1; round <= 3 && w < 2 && l < 2; round++) {
    const p = segWin((usPower * (0.85 + rng.next() * 0.3)) / themPower);
    const win = rng.next() < p;
    if (win) w++; else l++;
    log.push(`${round}${type === 'duel1' ? '라운드' : '구간'}: ${win ? `${usName}, ${pickLine(rng, 'win')}` : `${themName}이(가) 우세 — ${usName}, ${pickLine(rng, 'lose')}`}`);
    // 맞짱: 우세 확률 85% 이상인 라운드는 30% 확률로 즉시 KO
    if (type === 'duel1' && Math.max(p, 1 - p) >= 0.85 && rng.next() < 0.3) { if (win) w = 2; else l = 2; log.push(win ? `${usName}의 필살기 컷! 즉시 승부가 났습니다.` : `${themName}의 필살기 컷! 즉시 승부가 났습니다.`); break; }
  }
  const won = w > l;
  const cls = enemy.cls;
  let effect = '';
  if (type === 'duel1') {
    if (won) {
      const moved = cls.owner === 'player' ? 0 : addFear(s, cls, 25);
      ours[0].fameExp += 50;
      effect = `${classLabel(cls.id)} 짱을 꺾었습니다. 공포 +${moved.toFixed(1)}%p.`;
      if (cls.owner !== 'player' && cls.support.player >= 50) { cls.owner = 'player'; cls.lowTurns = 0; count('conquer'); effect += ` 지지도가 50%를 넘어 ${classLabel(cls.id)}을(를) 점령했습니다!`; }
      count('fightWin');
    } else {
      const f = r.fear[cls.id] ?? 0;
      if (f > 0) { transfer(cls, 'player', 'none', f / 2, false); r.fear[cls.id] = f / 2; }
      effect = `우리 짱이 졌습니다.${f > 0 ? ` 그 반의 공포가 절반으로 줄었습니다.` : ''}`;
    }
  } else if (type === 'gang') {
    if (won) { const moved = cls.owner === 'player' ? 0 : addFear(s, cls, 15); effect = `패싸움에서 이겼습니다. ${classLabel(cls.id)} 공포 +${moved.toFixed(1)}%p.`; count('fightWin'); }
    else effect = '패싸움에서 밀렸습니다.';
  } else if (won) {
    r.pado.schoolBoss = true;
    for (const c of s.school.classes) if (c.id !== HOMEROOM_ID) addFear(s, c, 10, 'others');
    effect = `전면전에서 이겼습니다. ${boss(s)?.name}이(가) 학교 짱입니다! 모든 반 공포 +10%p, 이후 공포가 절반 속도로만 줄어듭니다.`;
    count('fightWin');
  } else effect = '전면전에서 밀렸습니다.';
  gain(s, 'pado', won ? 5 : 2);

  // 열기와 발각
  const heatUp = Math.round(T.heat * P.heat + (video ? 10 : 0));
  r.pado.heat = clamp(r.pado.heat + heatUp, 0, 100);
  let caught = '';
  const pCatch = (r.pado.heat >= 50 ? (r.pado.heat - 40) / 100 : 0) + (P.night && s.warden.relation < 30 ? 0.1 : 0);
  if (rng.next() < pCatch) caught = schoolViolenceCommittee(s, ours, rng);

  // 부상: 15% - 맷집 × 0.5%, 진 쪽 ×1.5 (경상 80% 1~2턴, 중상 20% 4~8턴)
  const hurt = [];
  for (const st of ours) {
    const p = (0.15 - st.stats['맷집'] * 0.005) * (won ? 1 : 1.5) * P.injury;
    if (!isOut(s, st) && rng.next() < p) {
      const heavy = rng.next() < 0.2;
      st.outUntil = s.turn + (heavy ? rng.int(4, 8) : rng.int(1, 2));
      st.outWhy = heavy ? '부상(중상)' : '부상(경상)';
      hurt.push(`${st.name}(${heavy ? '중상' : '경상'})`);
    }
  }

  // 패도 + 인플루언서: 싸움 영상 조회수 ×3, 열기 +10, 논란 +10
  let vid = '';
  if (video && r.inf.unlocked) {
    const views = Math.round(2400 * (1 + r.inf.followers / 8000) * (0.6 + rng.next()));
    r.inf.followers += Math.round(views * 0.02);
    r.inf.ctrv = clamp(r.inf.ctrv + 10, 0, 100);
    vid = ` 영상 조회수 ${views.toLocaleString()}, 팔로워 +${Math.round(views * 0.02)} (논란 +10).`;
  }

  const result = `${FIGHT_TYPES[type].name} ${won ? '승리' : '패배'} (${w}:${l}). ${effect} 열기 +${heatUp}.${hurt.length ? ` 부상: ${hurt.join(', ')}.` : ''}${vid}${caught}`;
  r.pado.last = { log, result, won };
  return done(result);
}

// 학폭위: 참가 학생 정학 2~4턴(출전 불가, 사기 -2), 주동자 20% 강제 전학, 비호 기록이 있으면 50% 교사 연루(신임 -40)
function schoolViolenceCommittee(s, ours, rng) {
  const r = s.routes;
  for (const st of ours) { st.outUntil = s.turn + rng.int(2, 4); st.outWhy = '정학'; shiftMorale(st, -2); }
  let extra = '';
  const b = boss(s);
  if (b && rng.next() < 0.2) {
    s.students = s.students.filter((x) => x.id !== b.id);
    r.pado.boss = null;
    extra += ` 주동자 ${b.name}은(는) 강제 전학을 갔습니다.`;
  }
  if (r.pado.cover > 0 && rng.next() < 0.5) { s.trust = clamp(s.trust - 40, 0, 100); extra += ' 교사 연루가 드러나 교장 신임 -40.'; }
  r.pado.heat = Math.max(0, r.pado.heat - 30);
  addMessage({ kind: 'warn', title: '학교폭력대책위원회가 열렸습니다', body: `싸움이 발각됐습니다. 참가 학생 ${ours.length}명 정학 2~4주 (출전 불가, 사기 -2단계).${extra}` });
  return ` 발각! 학폭위가 열렸습니다.${extra}`;
}

