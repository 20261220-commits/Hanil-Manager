// 교사 프로필 특성의 적용과 프로필 맞춤 이벤트
import { getState, save, addMessage, nextRng } from './state.js';
import { clamp } from './rng.js';
import { classById, transfer } from './school.js';
import { shiftMorale } from './turn.js';
import { TEACHER_STATS, sanitizeTraits, sanitizeEvent, keywordEvent, effectText } from '../content/persona.js';
import { HOMEROOM_ID } from '../content/factions.js';
import { aiEnabled, aiEvent } from '../ai-client.js';

// 1학기+여름방학 = 0, 2학기+겨울방학 = 1 …
export const semesterOf = (turn) => Math.floor((turn - 1) / 24);

// 특성 효과의 합 (없으면 0)
export function mod(s, key) {
  return (s.persona?.traits ?? []).flatMap((t) => t.effects).filter((e) => e.key === key).reduce((a, e) => a + e.value, 0);
}

// 특성을 게임에 적용한다. 다시 쓸 때는 예전 능력치 변화를 되돌리고 새로 적용한다.
// start: 게임 시작 때만 적용하는 효과(시작 신임, 시작 결속도)도 넣는다.
export function applyPersona(s, { bio, traits, source }, { start = false } = {}) {
  const old = s.persona?.statDelta ?? {};
  for (const k in old) s.teacher[k] = clamp(s.teacher[k] - old[k], 1, 20);
  const clean = sanitizeTraits(traits);
  const statDelta = {};
  for (const e of clean.flatMap((t) => t.effects)) {
    if (!TEACHER_STATS.includes(e.key)) continue;
    const before = s.teacher[e.key];
    s.teacher[e.key] = clamp(before + e.value, 1, 20);
    statDelta[e.key] = (statDelta[e.key] ?? 0) + (s.teacher[e.key] - before);
  }
  const prev = s.persona;
  s.persona = {
    bio: String(bio ?? '').slice(0, 500), traits: clean, source, statDelta,
    editSem: start ? null : semesterOf(s.turn), nextEvent: prev?.nextEvent ?? s.turn + 2, wantEvent: false,
  };
  if (start) {
    s.trust = clamp(s.trust + mod(s, 'trust'), 0, 100);
    const b = mod(s, 'bond');
    if (b) for (const st of s.students) st.bond = clamp(st.bond + b, 0, 100);
  }
  return s.persona;
}

export const canEditPersona = (s) => !s.persona || s.persona.editSem !== semesterOf(s.turn);

// 주말 정산: 매주 예산 효과, 프로필 이벤트 예약 (3~5주에 1번 정도)
export function personaWeekly(s, rng) {
  if (!s.persona) return;
  const b = mod(s, 'budget');
  if (b) s.budget = Math.max(0, s.budget + b);
  if (s.turn + 1 >= s.persona.nextEvent && rng.next() < 0.6) {
    s.persona.wantEvent = true;
    s.persona.nextEvent = s.turn + 1 + 3 + Math.floor(rng.next() * 3);
  }
}

// 예약된 이벤트를 만든다. AI 서버가 있으면 AI가, 없거나 실패하면 키워드 규칙이 만든다.
// 주말 정산 뒤에 화면 쪽에서 부른다 (기다리지 않아도 된다).
let busy = false;
export async function deliverPersonaEvent() {
  const s = getState();
  if (!s?.persona?.wantEvent || busy) return false;
  busy = true;
  s.persona.wantEvent = false;
  let ev = null, source = 'keyword';
  try {
    if (aiEnabled()) {
      try {
        const r = await aiEvent(s.persona.bio, s.persona.traits, s.weekLabel);
        ev = sanitizeEvent(r.event);
        if (ev) source = 'ai';
      } catch { ev = null; }
    }
    if (getState() !== s) return false; // 그 사이 대기 화면으로 나갔다
    const rng = nextRng();
    ev ??= sanitizeEvent(keywordEvent(s.persona.traits, rng));
    if (!ev) return false;
    const st = ev.target === 'student' || ev.body.includes('{학생}') ? s.students[Math.floor(rng.next() * s.students.length)] : null;
    const fill = (t) => t.replaceAll('{학생}', st ? st.name : '한 학생');
    const msg = {
      kind: 'event',
      title: `${fill(ev.title)}`,
      body: fill(ev.body),
      tag: source === 'ai' ? '프로필 이벤트 · AI' : '프로필 이벤트',
      persona: { target: ev.target, studentId: st?.id ?? null, choices: ev.choices },
      ref: {},
    };
    if (ev.choices.length === 1 && !ev.choices[0].effects.length) {
      msg.kind = 'info';
    } else if (ev.choices.length === 1) {
      msg.kind = 'info';
      msg.body += `\n${applyEventEffects(s, ev.choices[0].effects, ev.target, st?.id)}`;
    } else {
      msg.choices = ev.choices.map((c, i) => ({ key: `c${i}`, label: c.label, desc: c.effects.map((e) => effectText(e, true)).join(', ') || '변화 없음' }));
    }
    addMessage(msg);
    save();
    window.dispatchEvent(new CustomEvent('game:changed'));
    return true;
  } finally {
    busy = false;
  }
}

// 이벤트 효과를 적용하고 결과 문장을 돌려준다.
export function applyEventEffects(s, effects, target, studentId) {
  const rng = nextRng();
  const st = studentId ? s.students.find((x) => x.id === studentId) : null;
  const people = st && target === 'student' ? [st] : s.students;
  const out = [];
  for (const e of effects) {
    const v = e.value;
    if (e.key === 'morale') {
      let n = 0;
      for (const p of people) {
        if (people.length > 1 && rng.next() > 0.35 * Math.abs(v)) continue;
        if (shiftMorale(p, people.length > 1 ? Math.sign(v) : v)) n++;
      }
      out.push(people.length > 1 ? `사기가 ${v > 0 ? '오른' : '떨어진'} 학생 ${n}명` : `${st.name} 사기 ${v > 0 ? '+' : ''}${v}단계`);
    } else if (e.key === 'condition') {
      for (const p of people) p.condition = clamp(p.condition + v, 30, 100);
      out.push(`컨디션 ${v > 0 ? '+' : ''}${v}`);
    } else if (e.key.startsWith('need_')) {
      const k = e.key.slice(5);
      for (const p of people) p.needs[k] = clamp(p.needs[k] + v, 0, 100);
      out.push(effectText(e, true));
    } else if (e.key === 'bond') {
      for (const p of people) p.bond = clamp(p.bond + v, 0, 100);
      out.push(effectText(e, true));
    } else if (e.key === 'trust') { s.trust = clamp(s.trust + v, 0, 100); out.push(effectText(e, true)); }
    else if (e.key === 'budget') { s.budget = Math.max(0, s.budget + v); out.push(effectText(e, true)); }
    else if (e.key === 'fatigue') { s.fatigue = clamp(s.fatigue + v, 0, 100); out.push(effectText(e, true)); }
    else if (e.key === 'support') {
      const home = classById(s, HOMEROOM_ID);
      if (v > 0) transfer(home, 'others', 'player', v); else transfer(home, 'player', 'none', -v, false);
      out.push(effectText(e, true));
    }
  }
  return out.length ? `결과: ${out.join(', ')}` : '아무 일도 일어나지 않았습니다.';
}

// 받은 편지함에서 프로필 이벤트 선택지를 골랐을 때
export function resolvePersonaChoice(s, m, key) {
  const idx = Number(String(key).slice(1));
  const ch = m.persona.choices[idx];
  if (!ch) return null;
  return `"${ch.label}" — ${applyEventEffects(s, ch.effects, m.persona.target, m.persona.studentId)}`;
}
