// AI 계파 행동 (룰북 7.5). 매주 주말 정산에서 계파마다 AP 5를 쓴다.
// 후보 행동마다 점수를 매기고, 점수가 높은 것부터 AP가 떨어질 때까지 실행한다.
// AI끼리도 서로 싸우므로 플레이어가 가만히 있어도 판도가 바뀐다.
import { addMessage, count } from './state.js';
import { clamp } from './rng.js';
import { isVacation } from './calendar.js';
import { championClass, rosterOf, transfer, ownedRatio, placeInfo } from './school.js';

// 대결에 나갈 반: 반 대상이면 같은 학년(같은 층)의 우리 반, 야외 구역이면 대표 반.
// 평면도가 없어서 인접 규칙(8.1) 대신 "같은 층끼리만 대결" 로 흉내 낸다.
function attackerClass(s, f, t) {
  if (t.kind !== 'class') return championClass(s, f);
  return s.school.classes.find((c) => c.owner === f && c.grade === t.cls.grade) ?? null;
}
import { subjectBonus, target, refusedSport, teamStrength, actualSport, homeSide, aiTactics, settle, applyToStudents, autoSetup } from './duel.js';
import { SPORTS, createMatch, playSegment, aiTimeout } from './match.js';
import { teacherStat } from './turn.js';
import { isAlly } from './intrigue.js';
import { FACTIONS, AI_FACTIONS, HOMEROOM_ID, classLabel } from '../content/factions.js';

// 계파별 성향 가중치 (7.5 표)
export const WEIGHTS = {
  elder: { duel: 0.6, recruit: 0.8, scheme: 1.0, defend: 1.5 },
  exam: { duel: 1.0, recruit: 1.3, scheme: 0.7, defend: 1.0 },
  pe: { duel: 1.5, recruit: 0.8, scheme: 0.6, defend: 1.0 },
  innov: { duel: 0.8, recruit: 1.0, scheme: 1.4, defend: 0.8 },
};
const AP = 5;
const COST = { duel: 2, recruit: 2, scheme: 1, defend: 1 };

// 플레이어 위협도 (반패권 연합)
export function threat(s) {
  const r = ownedRatio(s, 'player');
  if (r >= 0.5) return { tier: 3, label: '반플레이어 연합', mult: 2.0, ratio: r };
  if (r >= 0.3) return { tier: 2, label: '견제', mult: 1.6, ratio: r };
  if (r >= 0.15) return { tier: 1, label: '경계', mult: 1.3, ratio: r };
  return { tier: 0, label: '무시', mult: 1, ratio: r };
}

// 시기 보정: 입시파는 시험 4주 전부터 공세, 체육부장은 시험 2주 전부터 공세 중단·체육대회 때 공세
function timing(f, turn) {
  if (f === 'exam' && ((turn >= 4 && turn <= 8) || (turn >= 13 && turn <= 17))) return 1.5;
  if (f === 'pe' && ((turn >= 6 && turn <= 8) || (turn >= 15 && turn <= 17))) return 0;
  if (f === 'pe' && (turn === 9 || turn === 10)) return 1.5;
  return 1;
}

export function aiWeek(s, rng) {
  const sc = s.school;
  const news = [];
  if (s.turn < 3) { sc.ai.news = []; return; }
  const th = threat(s);
  const duelsOpen = !isVacation(s.turn);
  const capOnPlayer = th.tier >= 2 ? 2 : 1;
  let onPlayer = 0;
  const targeted = new Set();
  const rosters = new Map();
  const rosterFor = (cls) => { if (!rosters.has(cls.id)) rosters.set(cls.id, rosterOf(s, cls)); return rosters.get(cls.id); };
  const ratios = new Map();
  const defenderRoster = (t) => (t.owner === 'player' ? (t.kind === 'class' && t.id !== HOMEROOM_ID ? rosterFor(t.cls) : s.students)
    : t.kind === 'class' ? rosterFor(t.cls) : t.roster());
  // AI가 보는 상대 전력비: 세 종목 평균 적합도 비율
  const ratio = (f, champ, t) => {
    const k = `${f}|${t.id}`;
    if (!ratios.has(k)) {
      const a = rosterFor(champ), b = defenderRoster(t);
      ratios.set(k, Object.keys(SPORTS).reduce((acc, sp) => acc + teamStrength(a, sp) / teamStrength(b, sp), 0) / 3);
    }
    return ratios.get(k);
  };

  for (const f of rng.shuffle(AI_FACTIONS)) {
    if (sc.ai.gone[f]) continue;
    const w = WEIGHTS[f];
    // 교무실에서 사이가 나빠진 계파(관계 -40 이하)는 우리를 더 노린다 (적대 계파 대상 행동 ×1.3)
    const hostile = (sc.rel?.[f] ?? 0) <= -40 ? 1.3 : 1;
    const allied = isAlly(s, f); // 동맹 중에는 우리 땅을 건드리지 않는다
    let ap = AP;
    let duels = 0;
    for (let step = 0; step < 6 && ap > 0; step++) {
      const cands = [];
      const allTargets = [
        ...sc.classes.filter((c) => c.owner !== f).map((c) => target(s, c.id)),
        ...sc.places.filter((p) => p.owner !== f && placeInfo(p.id).kind === 'outdoor').map((p) => target(s, p.id)),
      ];
      // 대결
      const tmul = timing(f, s.turn) * (f === 'elder' && sc.ai.elderNew >= 1 ? 0 : 1);
      // 대결은 계파마다 한 주에 1번 (플레이어가 따라잡을 수 있게 하는 프로토타입 조정)
      if (duelsOpen && duels < 1 && ap >= COST.duel && tmul > 0) {
        for (const t of allTargets) {
          if (targeted.has(t.id)) continue;
          if (t.owner === 'player' && (onPlayer >= capOnPlayer || allied)) continue;
          const champ = attackerClass(s, f, t);
          if (!champ) continue;
          // 담임반은 빼앗을 수 없는 반이라 노릴 가치가 낮다
          const val = t.kind === 'class' ? (t.id === HOMEROOM_ID ? 4 : 10) : 15;
          const inst = t.kind === 'class' ? 1 + Math.max(0, 60 - t.cls.support[t.owner]) / 30 + t.cls.support[f] / 50 : 1;
          const score = val * w.duel * inst * ratio(f, champ, t) ** 4 * tmul * (t.owner === 'player' ? th.mult * hostile : 1);
          cands.push({ type: 'duel', t, champ, score });
        }
      }
      // 포섭: 우리 몫이 어느 정도 있는 반에서 학생을 빼온다
      if (ap >= COST.recruit) {
        for (const c of sc.classes) {
          if (c.owner === f || c.support[f] < 8 || c.support[f] > 55 || (allied && c.owner === 'player')) continue;
          const score = 10 * w.recruit * (c.support[f] / 30) * (c.owner === 'none' ? 1.2 : 1) * (c.owner === 'player' ? th.mult * hostile : 1);
          cands.push({ type: 'recruit', c, score });
        }
      }
      // 공작(소문): 다른 계파가 가진 반의 지지도를 깎는다
      if (ap >= COST.scheme) {
        for (const c of sc.classes) {
          if (c.owner === f || c.owner === 'none' || c.id === HOMEROOM_ID || (allied && c.owner === 'player')) continue;
          const score = 5 * w.scheme * (c.support[c.owner] < 60 ? 1.3 : 1) * (c.owner === 'player' ? th.mult * hostile : 1);
          cands.push({ type: 'scheme', c, score });
        }
      }
      // 방어: 자기 반의 지지도가 55% 밑이면 훈화·상담 (×2)
      if (ap >= COST.defend) {
        for (const c of sc.classes) {
          if (c.owner !== f || c.support[f] >= 55) continue;
          cands.push({ type: 'defend', c, score: 10 * w.defend * 2 * (1 + (55 - c.support[f]) / 20) });
        }
      }
      if (!cands.length) break;
      for (const x of cands) x.roll = x.score * (0.75 + rng.next() * 0.5);
      cands.sort((a, b) => b.roll - a.roll);
      const pick = cands[0];
      if (pick.roll < 4) break;
      ap -= COST[pick.type];

      if (pick.type === 'duel') {
        targeted.add(pick.t.id);
        duels++;
        if (pick.t.owner === 'player') onPlayer++;
        const line = aiDuel(s, f, pick.champ, pick.t, rosterFor(pick.champ), defenderRoster(pick.t), rng);
        if (line) news.push(line);
      } else if (pick.type === 'recruit') {
        const p = 0.6 + (pick.c.owner === 'none' ? 0.2 : 0) + (ownsPlace(s, f, 'club') ? 0.1 : 0) + (ownsPlace(s, f, 'roof') ? 0.1 : 0);
        if (rng.next() < p) {
          const before = pick.c.support.player;
          transfer(pick.c, 'others', f, 4);
          const lost = before - pick.c.support.player;
          if (lost >= 0.5) news.push(`${FACTIONS[f].name}이(가) ${classLabel(pick.c.id)} 학생들을 포섭했습니다 (우리 지지도 -${lost.toFixed(1)}%p).`);
        }
      } else if (pick.type === 'scheme') {
        const victim = pick.c.owner;
        transfer(pick.c, victim, 'none', 4, false);
        if (victim === 'player') {
          news.push(rng.next() < 0.35 ? `${classLabel(pick.c.id)}에 우리 계파에 대한 나쁜 소문이 돌았습니다. 출처는 ${FACTIONS[f].name} 쪽입니다 (지지도 -4%p).`
            : `${classLabel(pick.c.id)}에 우리 계파에 대한 나쁜 소문이 돌았습니다. 누가 퍼뜨렸는지는 모릅니다 (지지도 -4%p).`);
        }
      } else if (pick.type === 'defend') {
        transfer(pick.c, 'others', f, 3);
      }
    }
  }

  // 계파 소멸: 반도 땅도 없으면 남은 교사는 무소속이 된다
  for (const f of AI_FACTIONS) {
    if (sc.ai.gone[f]) continue;
    const has = sc.classes.some((c) => c.owner === f) || sc.places.some((p) => p.owner === f);
    if (!has) {
      sc.ai.gone[f] = true;
      for (const c of sc.classes) if (c.teacher.faction === f) c.teacher.faction = 'none';
      news.push(`${FACTIONS[f].name} 계파가 무너졌습니다. 남은 교사들은 무소속이 됐습니다.`);
    }
  }

  sc.ai.news = news;
  if (news.length) {
    addMessage({ kind: 'info', title: `교내 소식 (${s.weekLabel})`, body: news.slice(0, 10).join('\n') + (news.length > 10 ? `\n외 ${news.length - 10}건` : '') });
  }
}

const ownsPlace = (s, f, id) => s.school.places.find((p) => p.id === id)?.owner === f;

// AI가 건 대결을 끝까지 자동으로 치른다. 우리가 지키는 쪽이면 위임 대결(자동 설정)로 막는다.
function aiDuel(s, f, champ, t, attackRoster, defendRoster, rng) {
  const defender = t.owner;
  const refused = refusedSport(s, { ...t, roster: () => defendRoster }, attackRoster);
  let best = null;
  for (const sport of Object.keys(SPORTS)) {
    if (sport === refused) continue;
    const r = teamStrength(attackRoster, sport) / teamStrength(defendRoster, sport);
    if (!best || r > best.r) best = { sport, r };
  }
  const sport = actualSport(s, best.sport);
  const A = { key: f, name: classLabel(champ.id), faction: f, lead: champ.teacher.lead, players: attackRoster, tactics: aiTactics(sport, rng) };
  let B;
  const usesHomeroom = defender === 'player' && defendRoster === s.students;
  if (defender === 'player') {
    const setup = usesHomeroom ? autoSetup(s, sport, {}) : { tactics: aiTactics(sport, rng) };
    B = { key: 'player', name: usesHomeroom ? s.className : t.team, faction: 'player', lead: teacherStat('지도력'),
      bonus: subjectBonus(s), players: defendRoster, lineup: setup.lineup, tactics: setup.tactics };
  } else {
    B = { key: defender, name: t.team, faction: defender, lead: t.lead, players: defendRoster, tactics: aiTactics(sport, rng) };
  }
  if (homeSide(s, sport, f) === 'attacker') A.home = true; else B.home = true;
  const m = createMatch(sport, A, B, rng);
  // 위임 대결의 작전 타임: 교사 지도력 × 4% 확률로 최적 판단 (9.8)
  const smartB = defender === 'player' ? clamp(teacherStat('지도력') * 0.04, 0, 1) : 0.6;
  while (!m.done) {
    if (m.seg > 0) { aiTimeout(m, 0, rng, 0.6); aiTimeout(m, 1, rng, smartB); }
    playSegment(m, rng);
  }
  const win = m.winner === 0 ? true : m.winner === 1 ? false : null;
  const ownerBefore = t.owner;
  const r = settle(s, t, f, defender, win, m.grade, rng, 10);
  if (r.conquered && f === 'elder') s.school.ai.elderNew++;
  const score = `${m.score[0]}:${m.score[1]}`;
  const verb = win === true ? (m.grade.key === 'rout' ? '압승' : '승리') : win === false ? '패배' : '무승부';

  if (defender === 'player') {
    if (usesHomeroom) applyToStudents(s, m, 1, rng);
    if (win === false) count('defendWin');
    addMessage({
      kind: win === true ? 'warn' : 'report',
      title: `${FACTIONS[f].name}의 도전: ${t.label} ${win === false ? '방어 성공' : win === true ? '방어 실패' : '무승부'} (${SPORTS[sport].name} ${score})`,
      body: [
        `${classLabel(champ.id)}(${FACTIONS[f].name})이(가) ${t.label}에 ${SPORTS[sport].name} 대결을 걸어 왔습니다. 자동 설정과 위임 판단으로 맞섰습니다.`,
        t.kind === 'class' ? `${t.label} 우리 지지도 ${r.moved > 0 ? '-' : '+'}${Math.abs(r.moved).toFixed(1)}%p (현재 ${Math.round(t.cls.support.player)}%).` : '',
        r.conquered ? `${t.label}을(를) ${FACTIONS[f].name}에게 빼앗겼습니다.` : '',
        usesHomeroom ? '출전한 담임반 학생들의 컨디션이 떨어졌습니다.' : '',
      ].filter(Boolean).join('\n'),
    });
    return null;
  }
  return `${FACTIONS[f].short} ${classLabel(champ.id)} → ${t.label}(${FACTIONS[ownerBefore].short}) ${SPORTS[sport].name} ${score} ${verb}${r.conquered ? ` · ${t.label} 점령` : ''}`;
}
