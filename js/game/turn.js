// 턴 진행: 주간 행동(AP)과 주말 정산 (룰북 3장, 4.7~4.8, 13장)
import { getState, save, studentById, nextRng, addMessage, pendingDecisions, count, checkTitles } from './state.js';
import { observe, calcCA, needLevel, topNeed } from './students.js';
import { weekLabel, eventOf, nearExam, isHomecoming } from './calendar.js';
import { STAT_GROUPS, STAT_LABEL, MORALE } from '../content/stats.js';
import { PERSONALITIES } from '../content/personality.js';
import { clamp } from './rng.js';
import { weeklySchool, semesterGoal } from './school.js';
import { aiWeek } from './ai.js';

const PERS = Object.fromEntries(PERSONALITIES.map((p) => [p.name, p]));
const MENTAL = STAT_GROUPS[0].stats, MIND = STAT_GROUPS[1].stats, BODY = STAT_GROUPS[2].stats;
const statName = (k) => STAT_LABEL[k] ?? k;

// ---------- 공통 ----------

// 피로가 쌓이면 교사 능력치가 떨어진다 (룰북 3.4)
export function teacherStat(key) {
  const s = getState();
  const pen = s.fatigue >= 70 ? 3 : s.fatigue >= 50 ? 1 : 0;
  return Math.max(1, s.teacher[key] - pen);
}

export function shiftMorale(st, d) {
  const i = clamp(MORALE.indexOf(st.morale) + d, 0, MORALE.length - 1);
  const changed = MORALE[i] !== st.morale;
  st.morale = MORALE[i];
  return changed;
}

function lowerNeeds(st, amount, only) {
  for (const k in st.needs) if (!only || k === only) st.needs[k] = clamp(Math.round(st.needs[k] - amount), 0, 100);
}

function spend(ap, key) {
  const s = getState();
  if (s.ap < ap) return `AP가 부족합니다 (필요 ${ap}, 남은 ${s.ap}).`;
  if (key && s.usedThisWeek[key]) return '이번 주에 이미 했습니다.';
  s.ap -= ap;
  if (key) s.usedThisWeek[key] = true;
  return null;
}

// 행동이 끝날 때마다 칭호 조건을 확인하고 저장한다.
const done = (msg) => { checkTitles(); save(); return { ok: true, msg }; };
const fail = (msg) => ({ ok: false, msg });

// ---------- 행동 ----------

export const ACTIONS = {
  counsel: { label: '개인 상담', ap: 1, target: 'student', desc: '사기를 올리고 가장 큰 욕구를 낮춥니다. 성공률은 교사의 상담 능력에 따라 다릅니다.' },
  observe: { label: '학생 관찰', ap: 1, target: 'student', desc: '포텐 추정치와 행운을 확인합니다. 입학식 주간에는 3번 무료입니다.' },
  focus: { label: '개인 특훈', ap: 1, target: 'student', desc: '2주 동안 고른 스탯 하나를 집중 훈련합니다 (성장 3배).' },
  talk: { label: '학급 훈화', ap: 2, target: 'class', desc: '반 전체에 한마디 합니다. 성격에 따라 잘 먹히기도, 역효과가 나기도 합니다.' },
  snack: { label: '야식 이벤트', ap: 0, cost: 5, target: 'class', desc: '반 전체 식욕 -30, 다른 욕구 -10. 예산 5만원, 주 1회.' },
  bonding: { label: '반 단합 행사', ap: 2, cost: 10, target: 'class', desc: '반 전체 모든 욕구 -15. 예산 10만원, 주 1회.' },
  report: { label: '교장·교감 보고', ap: 1, target: 'teacher', desc: '교장 신임 +2. 주 1회.' },
  seminar: { label: '교사 연수', ap: 3, target: 'teacher', desc: '교사 능력치 하나를 1 올립니다 (최대 20).' },
  overtime: { label: '야근', ap: 0, target: 'teacher', desc: 'AP +1, 피로 +15. 한 주에 최대 2번.' },
};

export function doCounsel(id) {
  const s = getState(), st = studentById(id);
  const err = spend(1); if (err) return fail(err);
  const rng = nextRng();
  const p = clamp(0.5 + teacherStat('상담') * 0.025 - (s.fatigue >= 90 ? 0.2 : 0), 0.1, 0.95);
  st.lastCounsel = s.turn;
  if (rng.next() < p) {
    const need = topNeed(st);
    const amount = st.personality === '외로움 탐' ? 30 : 20;
    lowerNeeds(st, amount, need);
    shiftMorale(st, 1);
    st.bond = clamp(st.bond + 5, 0, 100);
    count('counselOK');
    return done(`${st.name}와 이야기가 잘 통했습니다. 사기가 올랐고 고민(${needName(need)})이 ${amount} 줄었습니다.`);
  }
  st.bond = clamp(st.bond + 1, 0, 100);
  return done(`${st.name}와의 대화가 겉돌았습니다. 변화가 없습니다.`);
}

export function doObserve(id) {
  const s = getState(), st = studentById(id);
  if (st.observed) return fail('이미 관찰한 학생입니다.');
  const free = s.turn === 1 && s.freeObservations > 0;
  if (!free) { const err = spend(1); if (err) return fail(err); } else s.freeObservations -= 1;
  observe(nextRng(), st, teacherStat('안목'));
  if (['-10', '-9', '-8'].includes(st.potTier)) count('gemFound');
  return done(`${st.name}을(를) 관찰했습니다. 포텐 추정 ${st.estimate.low}~${st.estimate.high}, 행운 ${st.luck}.`);
}

export function doFocus(id, stat) {
  const s = getState(), st = studentById(id);
  if (st.focus && st.focus.until > s.turn) return fail(`${st.name}은(는) 이미 ${statName(st.focus.stat)} 특훈 중입니다.`);
  const err = spend(1); if (err) return fail(err);
  st.focus = { stat, until: s.turn + 2 };
  return done(`${st.name}의 ${statName(stat)} 특훈을 시작합니다 (2주).`);
}

const TALK_NAMES = ['압박', '격려', '침착'];
export function doTalk(kind) {
  const s = getState();
  const err = spend(2, 'talk'); if (err) return fail(err);
  const rng = nextRng();
  const base = 0.4 + teacherStat('동기부여') * 0.025;
  let up = 0, down = 0;
  for (const st of s.students) {
    if (st.trait === '마이웨이') continue;
    const r = PERS[st.personality].talk[kind];
    let p = r === '◎' ? Math.min(0.95, base * 1.5) : base;
    if (st.personality === '고집' || st.personality === '냉정') p /= 2;
    const backfire = r === '✕' || (kind === 0 && st.trait === '유리멘탈');
    if (backfire && st.personality !== '냉정') { if (rng.next() < p && shiftMorale(st, -1)) down++; }
    else if (rng.next() < p && shiftMorale(st, 1)) up++;
  }
  if (up >= 10) count('bigTalk');
  return done(`${TALK_NAMES[kind]} 훈화를 했습니다. 사기가 오른 학생 ${up}명, 떨어진 학생 ${down}명.`);
}

export function doSnack() {
  const s = getState();
  if (s.budget < 5) return fail('예산이 부족합니다 (5만원 필요).');
  const err = spend(0, 'snack'); if (err) return fail(err);
  s.budget -= 5;
  for (const st of s.students) { lowerNeeds(st, 30, 'food'); for (const k in st.needs) if (k !== 'food') lowerNeeds(st, 10, k); }
  return done('반 전체에 야식을 돌렸습니다. 식욕 -30, 다른 욕구 -10.');
}

export function doBonding() {
  const s = getState();
  if (s.budget < 10) return fail('예산이 부족합니다 (10만원 필요).');
  const err = spend(2, 'bonding'); if (err) return fail(err);
  s.budget -= 10;
  for (const st of s.students) lowerNeeds(st, 15);
  return done('반 단합 행사를 열었습니다. 모든 욕구 -15.');
}

export function doReport() {
  const s = getState();
  const err = spend(1, 'report'); if (err) return fail(err);
  s.trust = clamp(s.trust + 2, 0, 100);
  return done('교장·교감에게 보고했습니다. 신임 +2.');
}

export function doSeminar(stat) {
  const s = getState();
  if (s.teacher[stat] >= 20) return fail('이미 최대치입니다.');
  const err = spend(3); if (err) return fail(err);
  s.teacher[stat] += 1;
  return done(`연수를 받았습니다. ${stat} ${s.teacher[stat] - 1} → ${s.teacher[stat]}.`);
}

export function doOvertime() {
  const s = getState();
  if (s.overtime >= 2) return fail('이번 주에는 더 야근할 수 없습니다.');
  count('overtime');
  s.overtime += 1; s.ap += 1; s.fatigue = clamp(s.fatigue + 15, 0, 100);
  return done(`야근으로 AP +1. 피로 ${s.fatigue}.`);
}

export function setTraining(t) {
  const s = getState();
  s.training = t;
  save();
}

// ---------- 일탈 결정 (룰북 13.1) ----------

const DEVIANCE = {
  ramen: { label: '라면을 몰래 끓여 먹다', caught: '라면 발각' },
  escape: { label: '새벽에 기숙사를 빠져나가다', caught: '새벽탈출 발각' },
  chromebook: { label: '호실에서 크롬북을 몰래 쓰다', caught: '기숙사 크롬북 발각' },
  vuln: { label: '크롬북 취약점을 찾다', caught: '기숙사 크롬북 발각' },
  gamedev: { label: '몰래 게임을 만들다', caught: '기숙사 크롬북 발각' },
  phone: { label: '핸드폰을 몰래 쓰다', caught: '핸드폰 발각' },
};

export function resolveDecision(msgId, choice) {
  const s = getState();
  const m = s.inbox.find((x) => x.id === msgId);
  if (!m || m.resolved) return fail('이미 처리한 일입니다.');
  const st = studentById(m.ref.studentId);
  let msg;
  if (choice === 'cover') {
    count('cover');
    st.bond = clamp(st.bond + 20, 0, 100);
    if (s.warden.relation < 70) s.trust = clamp(s.trust - 3, 0, 100);
    s.warden.relation = clamp(s.warden.relation - 10, 0, 100);
    msg = `${st.name}을(를) 감쌌습니다. 결속도가 올랐지만 사감과의 관계가 나빠졌습니다.`;
  } else if (choice === 'penalty') {
    count('strict');
    shiftMorale(st, -1);
    s.warden.relation = clamp(s.warden.relation + 5, 0, 100);
    msg = `${st.name}에게 벌점을 줬습니다. 사기가 떨어졌고 사감과의 관계는 좋아졌습니다.`;
  } else {
    count('strict');
    shiftMorale(st, -2);
    st.calmUntil = s.turn + 4;
    msg = `${st.name}을(를) 크게 혼냈습니다. 4주 동안은 같은 일을 하지 않을 겁니다.`;
  }
  m.resolved = choice; m.read = true; m.result = msg;
  return done(msg);
}

// ---------- 주말 정산 ----------

const NEED_NAME = { play: '놀고 싶은 욕구', home: '귀가 욕구', grade: '성적 불안', food: '식욕', recog: '인정 욕구' };
export const needName = (k) => NEED_NAME[k];

export function canEndWeek() {
  const s = getState();
  if (s.duel && !s.duel.m.done) return '진행 중인 대결이 있습니다. 대결을 끝까지 치러 주세요.';
  const pend = pendingDecisions();
  return pend.length ? `처리하지 않은 일이 ${pend.length}건 있습니다. 받은 편지함에서 먼저 결정해 주세요.` : null;
}

export function endWeek() {
  const s = getState();
  const block = canEndWeek(); if (block) return fail(block);
  const rng = nextRng();
  const t = s.training;
  const grew = [];
  const coachMult = 1 + (teacherStat('지도력') - 10) * 0.03;

  for (const st of s.students) {
    // 1. 성장 (룰북 4.8)
    const p = PERS[st.personality];
    const need = needLevel(st);
    const needMult = need >= 90 ? 0.7 : need >= 70 ? 0.8 : need >= 40 ? 0.9 : 1;
    const condMult = st.condition < 60 && st.personality !== '성실' ? 0.85 : 1;
    const focusOn = st.focus && st.focus.until > s.turn;
    const effFocus = st.stats['집중력'] * (1 - need / 200);
    const headroom = Math.max(0, 1 - st.ca / st.pa);
    const base = 1.8 * ((effFocus + st.stats['절제']) / 40) * coachMult * 1.2 * needMult * condMult * headroom;
    for (const k of [...MENTAL, ...MIND, ...BODY]) {
      let share = MIND.includes(k) ? t.intel / 100 : BODY.includes(k) ? t.body / 100 * (k === '격투' || k === '맷집' ? 0.5 : 1) : (t.intel + t.body) / 200 * 0.35;
      if (st.trait === '헬창') share *= BODY.includes(k) ? 1.3 : MIND.includes(k) ? 0.9 : 1;
      let g = base * share * (k === p.up ? 1.1 : k === p.down ? 0.9 : 1) * (0.6 + rng.next() * 0.8);
      if (focusOn && st.focus.stat === k) g *= 3;
      st.prog[k] = (st.prog[k] ?? 0) + g;
      if (st.prog[k] >= 1 && st.stats[k] < 20) {
        st.prog[k] -= 1;
        st.stats[k] += 1;
        grew.push({ st, k, v: st.stats[k] });
      }
    }
    st.ca = Math.min(calcCA(st.stats), st.pa);
    // 특훈은 시작한 주와 다음 주, 2주 동안 이어진다.
    if (st.focus && st.focus.until <= s.turn + 1) st.focus = null;

    // 2. 욕구 증가 (룰북 4.7)
    const self = (1 - st.stats['절제'] * 0.03) * (st.personality === '성실' ? 0.8 : st.personality === '덜렁' ? 1.2 : 1);
    const add = {
      play: rng.int(5, 11) * (st.personality === '장난' ? 1.5 : 1),
      home: rng.int(4, 9) * (s.turn <= 20 ? 1.3 : 1) * (st.personality === '외로움 탐' ? 2 : 1),
      grade: rng.int(2, 7) * (nearExam(s.turn) ? 2 : 1) * (st.trait === '완벽주의자' ? 1.5 : 1) * (st.personality === '무사태평' ? 0.5 : 1),
      food: rng.int(4, 9) * (st.trait === '헬창' ? 1.5 : 1),
      recog: rng.int(3, 7) * (st.stats['자존감'] <= 7 ? 1.3 : 1),
    };
    for (const k in add) st.needs[k] = clamp(Math.round(st.needs[k] + add[k] * self - t.rest * 0.1), 0, 100);

    // 3. 컨디션
    st.condition = clamp(Math.round(st.condition + 10 + t.rest * 0.3 - (t.body >= 60 ? 8 : 0)), 30, 100);
  }

  // 4. 일탈 (룰북 13.1): 성공은 조용히, 발각만 편지함으로
  const moodMult = { 좋음: 0.7, 보통: 1, 나쁨: 1.5 }[s.warden.mood];
  const strictMult = 0.6 + s.warden.strict * 0.04;
  const luckMult = { 빨: 1.3, 주: 1.15, 노: 1, 연: 0.85, 초: 0.7 };
  let quiet = 0;
  for (const st of s.students) {
    if (st.calmUntil > s.turn) continue;
    const pers = ['장난', '대담'].includes(st.personality) ? 1.5 : ['성실', '얌전', '조심'].includes(st.personality) ? 0.5 : 1;
    const attempt = needLevel(st) * 0.003 * pers * (st.trait === '트러블 메이커' ? 2 : 1);
    if (rng.next() >= attempt) continue;
    const need = topNeed(st);
    const type = need === 'food' ? 'ramen' : need === 'home' ? 'phone' : need === 'recog' ? 'escape'
      : rng.pick(['chromebook', 'escape', 'gamedev', 'vuln']);
    const pCaught = 0.2 * (1 - st.stats['절제'] * 0.02) * (1 + st.stats['기행'] * 0.02) * moodMult * strictMult * luckMult[st.luck];
    if (rng.next() < pCaught) {
      s.caught[type] = (s.caught[type] ?? 0) + 1;
      addMessage({
        kind: 'event',
        title: `${DEVIANCE[type].caught}: ${st.name}`,
        body: `사감 선생님이 ${st.room.slice(3)}호에서 ${st.name}이(가) ${DEVIANCE[type].label} 걸린 것을 알려 왔습니다. 어떻게 할까요?`,
        ref: { studentId: st.id, type },
        choices: [
          { key: 'cover', label: '감싼다', desc: '결속도 +20. 교장 신임 -3, 사감 관계 -10' },
          { key: 'penalty', label: '벌점을 준다', desc: '사기 -1단계. 사감 관계 +5' },
          { key: 'scold', label: '크게 혼낸다', desc: '사기 -2단계. 4주 동안 일탈하지 않음' },
        ],
      });
    } else {
      quiet++;
      if (type === 'ramen') { lowerNeeds(st, 30, 'food'); if (rng.next() < 0.5) shiftMorale(st, 1); }
      else if (type === 'escape') { lowerNeeds(st, 25, 'play'); shiftMorale(st, 1); }
      else if (type === 'chromebook') lowerNeeds(st, 30, 'play');
      else if (type === 'phone') { lowerNeeds(st, 20, 'home'); lowerNeeds(st, 20, 'play'); }
      else if (type === 'vuln') { st.prog['문제해결력'] = (st.prog['문제해결력'] ?? 0) + 0.5; st.prog['논리력'] = (st.prog['논리력'] ?? 0) + 0.5; }
      else if (type === 'gamedev') { lowerNeeds(st, 20, 'play'); st.prog['창의성'] = (st.prog['창의성'] ?? 0) + 0.5; st.prog['기획력'] = (st.prog['기획력'] ?? 0) + 0.5; }
    }
  }

  // 5. 사기 흐름
  for (const st of s.students) {
    const need = needLevel(st);
    if (need >= 70 && rng.next() < 0.3) shiftMorale(st, -1);
    else if (need < 30 && MORALE.indexOf(st.morale) < 3 && rng.next() < 0.2) shiftMorale(st, 1);
    if (st.personality === '외로움 탐' && s.turn - st.lastCounsel >= 4 && rng.next() < 0.5) shiftMorale(st, -1);
    if (st.personality === '변덕' && rng.next() < 0.15) shiftMorale(st, rng.next() < 0.5 ? -1 : 1);
  }

  // 6. 랜덤 생물 (룰북 13.4) 가끔
  if (rng.next() < 0.2) creature(s, rng);

  // 7. 금요일 귀성
  if (isHomecoming(s.turn)) {
    for (const st of s.students) { st.needs.home = 0; st.condition = clamp(st.condition - 10, 30, 100); }
    addMessage({ kind: 'info', title: '금요일 귀성', body: '이번 주말에 학생들이 집에 다녀왔습니다. 귀가 욕구가 모두 사라졌고, 다음 주 월요일 컨디션이 조금 떨어졌습니다.' });
  }

  // 8. 주간 보고
  const top = grew.slice(0, 12).map((g) => `${g.st.name} ${statName(g.k)} ${g.v - 1}→${g.v}`);
  const warn = s.students.filter((st) => needLevel(st) >= 70).map((st) => st.name);
  addMessage({
    kind: 'report',
    title: `주간 보고 (${s.weekLabel})`,
    body: [
      grew.length ? `능력치가 오른 학생: ${grew.length}건 (${top.join(', ')}${grew.length > 12 ? ' 외' : ''})` : '이번 주에 오른 능력치가 없습니다.',
      warn.length ? `욕구가 70을 넘은 학생: ${warn.join(', ')}. 상담이나 야식으로 풀어 주세요.` : '욕구가 위험한 학생은 없습니다.',
      `훈련 배분: 지적 ${t.intel}% · 신체 ${t.body}% · 휴식 ${t.rest}%`,
    ].join('\n'),
  });

  // 9. 교내 판도: 일상 영향력, 담당 수업, 반장 선거, 지배권 (룰북 8.2)
  if (s.duel?.m.done) s.duel = null;
  aiWeek(s, rng); // AI 계파 행동 (룰북 7.5)
  for (const msg of weeklySchool(s, rng)) addMessage(msg);
  if (s.turn === 20) {
    const g = semesterGoal(s);
    s.trust = clamp(s.trust + (g.ok ? 10 : -10), 0, 100);
    addMessage({ kind: g.ok ? 'info' : 'warn', title: `1학기 평가: ${g.ok ? '목표 달성' : '목표 미달'}`,
      body: `담임반 지지도 ${Math.round(g.home)}% (목표 70%), 추가로 점령한 반 ${g.owned}개 (목표 1개). 교장 신임 ${g.ok ? '+10' : '-10'}.` });
  }

  // 10. 교사 피로와 다음 주 준비
  s.fatigue = clamp(s.fatigue - 10 - s.ap * 5 - 5, 0, 100);
  s.warden.mood = rng.weighted([['좋음', 25], ['보통', 50], ['나쁨', 25]]);
  s.turn += 1;
  s.weekLabel = weekLabel(s.turn);
  s.freeObservations = 0;
  s.usedThisWeek = {};
  s.overtime = 0;
  const sick = s.fatigue >= 100;
  s.ap = sick ? 0 : s.apMax;
  if (sick) addMessage({ kind: 'warn', title: '병가', body: '피로가 한계에 달해 이번 주는 쉬어야 합니다. 행동을 할 수 없습니다.' });
  if (s.warden.mood === '나쁨') addMessage({ kind: 'info', title: '사감 선생님 기분이 안 좋습니다', body: '주식이 떨어졌다는 소문입니다. 이번 주는 일탈이 걸리기 쉽습니다.' });
  const ev = eventOf(s.turn);
  if (ev) addMessage({ kind: 'info', title: `이번 주 일정: ${ev}`, body: eventText(ev) });
  return done(`새로운 주가 시작됐습니다: ${s.weekLabel}`);
}

function creature(s, rng) {
  const kind = rng.pick(['사슴벌레', '바퀴', '그리마']);
  if (kind === '사슴벌레') {
    const st = rng.pick(s.students);
    shiftMorale(st, st.personality === '천진난만' ? 2 : 1);
    addMessage({ kind: 'info', title: '사슴벌레 발견', body: `${st.name}이(가) 기숙사 앞에서 사슴벌레를 잡았습니다. 기분이 좋아 보입니다.` });
  } else {
    const room = rng.pick([...new Set(s.students.map((x) => x.room))]);
    const people = s.students.filter((x) => x.room === room);
    for (const st of people) {
      if (kind === '바퀴') shiftMorale(st, -1);
      else st.condition = clamp(st.condition - 10, 30, 100);
    }
    addMessage({ kind: 'info', title: `${kind} 출몰: ${room.slice(3)}호`,
      body: kind === '바퀴' ? `${room.slice(3)}호에 바퀴벌레가 나왔습니다. 그 방 학생들의 사기가 떨어졌습니다.` : `${room.slice(3)}호에서 그리마가 나와 한밤중에 비명 소동이 났습니다. 그 방 학생들의 컨디션이 떨어졌습니다.` });
  }
}

function eventText(ev) {
  return {
    '학급 임원 선거': '반장 선거 주간입니다. 이번 주말에 선거가 열립니다. 담임반 지지도가 높을수록 우리 쪽 후보가 유리합니다.',
    중간고사: '중간고사 주간입니다. 지난 몇 주 동안 성적 불안이 빠르게 올랐을 겁니다.',
    체육대회: '전교 체육대회 주간입니다. 교내 판도에서 다른 반에 반 대항전을 신청해 보세요.',
    기말고사: '기말고사 주간입니다.',
    '학기 평가': '1학기 마지막 주입니다. 교장의 학기 평가가 있습니다.',
  }[ev] ?? '';
}
