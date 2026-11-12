// 내부고발자 루트 (룰북 12.4): AI 교사의 숨은 비리를 조사해 폭로한다
import { getState, save, nextRng, addMessage, count, checkTitles } from './state.js';
import { makeRng, clamp } from './rng.js';
import { classById, transfer, placeById } from './school.js';
import { teacherStat } from './turn.js';
import { allTeachers, teacherById } from './politics.js';
import { SURNAMES, GIVEN } from '../content/names.js';
import { CORRUPTION, PROBES, EXPOSE, EXPOSE_AP } from '../content/routes.js';
import { FACTIONS, AI_FACTIONS, HOMEROOM_ID, classLabel } from '../content/factions.js';
import { POSTS } from '../content/council.js';
import { ensureRoutes, gain } from './routes.js';

const fail = (msg) => ({ ok: false, msg });
const done = (msg) => { checkTitles(); save(); return { ok: true, msg }; };
const hash = (str) => [...str].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 1e9, 7);

// 교사마다 숨은 비리 0~2개 (시드로 고정). 조사해 보기 전에는 모른다
export function fileOf(s, t) {
  const r = ensureRoutes(s);
  if (!r.whistle.files[t.id]) {
    const rng = makeRng(s.seed * 17 + hash(t.id));
    const n = rng.weighted([[0, 3], [1, 4], [2, 3]]);
    r.whistle.files[t.id] = { sins: rng.shuffle(CORRUPTION).slice(0, n), evidence: {}, suspicion: 0, known: false };
  }
  return r.whistle.files[t.id];
}

export const targets = (s) => allTeachers(s).filter((t) => t.faction !== 'player' && t.classId !== HOMEROOM_ID);

const topAvg = (list, f, n) => { const v = list.map(f).sort((a, b) => b - a).slice(0, n); return v.reduce((a, x) => a + x, 0) / Math.max(1, v.length); };

export function probeGain(s, kind) {
  if (kind === 'tip') return clamp(Math.round(10 + (topAvg(s.students, (st) => st.stats['친화력'], 5) - 8) * 1.5 + (topAvg(s.students, (st) => st.bond, 5) - 50) / 10), 10, 20);
  if (kind === 'docs') return clamp(Math.round(15 + (teacherStat('행정력') - 8) * 1.2), 15, 25) + (placeById(s, 'dean')?.owner === 'player' ? 10 : 0);
  return clamp(Math.round(10 + (topAvg(s.students, (st) => (st.stats['기억력'] + st.stats['논리력']) / 2, 3) - 10) * 0.5), 6, 14);
}

export function probe(teacherId, sin, kind) {
  const s = getState();
  const r = ensureRoutes(s);
  const t = teacherById(s, teacherId);
  if (!t || t.faction === 'player') return fail('조사할 교사를 골라 주세요.');
  const P = PROBES[kind];
  if (!P) return fail('조사 방법을 골라 주세요.');
  if (s.ap < P.ap) return fail(`AP가 부족합니다 (필요 ${P.ap}).`);
  const f = fileOf(s, t);
  s.ap -= P.ap;
  gain(s, 'whistle', 2);
  f.suspicion = (f.suspicion ?? 0) + 10;
  if (!f.known) {
    f.known = true;
    if (!f.sins.length) { r.whistle.last = `${t.name} 선생님을 조사했지만 수상한 점이 없습니다. 깨끗한 교사입니다.`; return done(r.whistle.last); }
    r.whistle.last = `${t.name} 선생님에게서 수상한 정황을 찾았습니다: ${f.sins.join(', ')}.`;
    return done(r.whistle.last);
  }
  const target = f.sins.includes(sin) ? sin : f.sins[0];
  if (!target) return fail('이 교사에게는 캘 비리가 없습니다.');
  const g = probeGain(s, kind);
  f.evidence[target] = Math.min(100, (f.evidence[target] ?? 0) + g);
  let msg = `${t.name} 선생님 "${target}" 증거 +${g}% (지금 ${f.evidence[target]}%)`;
  // 보복: 의심 70 이상이면 반격 (증거 인멸 -30%p, 내 약점 조사)
  if (f.suspicion >= 70) {
    for (const k of f.sins) f.evidence[k] = Math.max(0, (f.evidence[k] ?? 0) - 30);
    f.suspicion = 40;
    r.whistle.counter++;
    addMessage({ kind: 'warn', title: `${t.name} 선생님이 눈치챘습니다`, body: '조사하는 걸 알아채고 반격했습니다. 증거가 30%p씩 사라졌고, 상대도 우리 약점을 캐기 시작했습니다 (폭로할 때 맞폭로 위험 증가).' });
    msg += ' · 상대가 눈치채고 반격했습니다!';
  }
  r.whistle.last = msg;
  return done(msg);
}

// 폭로에 필요한 증거: 인플루언서와 함께면 -10%p, 내부고발자 정점이면 교육청 60%
export function needFor(s, venue) {
  let need = EXPOSE[venue].need;
  if (s.routes?.inf?.unlocked) need -= 10;
  if (venue === 'office' && (s.routes?.m?.whistle ?? 0) >= 80) need = Math.min(need, 60);
  return need;
}

export function expose(teacherId, sin, venue) {
  const s = getState();
  const r = ensureRoutes(s);
  const t = teacherById(s, teacherId);
  if (!t || t.faction === 'player') return fail('폭로할 교사를 골라 주세요.');
  const f = fileOf(s, t);
  if (!f.known || !f.sins.includes(sin)) return fail('증거를 모은 비리를 골라 주세요.');
  if (!EXPOSE[venue]) return fail('폭로할 곳을 골라 주세요.');
  if (s.ap < EXPOSE_AP) return fail(`AP가 부족합니다 (필요 ${EXPOSE_AP}).`);
  s.ap -= EXPOSE_AP;
  const rng = nextRng();
  const ev = f.evidence[sin] ?? 0;
  const need = needFor(s, venue);
  const fac = t.faction;
  if (ev < need) {
    s.trust = clamp(s.trust - 25, 0, 100);
    if (AI_FACTIONS.includes(fac)) s.school.rel[fac] = clamp((s.school.rel[fac] ?? 0) - 40, -100, 100);
    r.whistle.last = `무고 판정: 증거 ${ev}%로는 ${EXPOSE[venue].name}에서 받아들여지지 않았습니다 (필요 ${need}%). 교장 신임 -25${AI_FACTIONS.includes(fac) ? `, ${FACTIONS[fac].name}과(와) 적대` : ''}.`;
    addMessage({ kind: 'warn', title: '폭로 실패: 무고 판정', body: r.whistle.last });
    return done(r.whistle.last);
  }
  // 위선 리스크: 비호 기록·들킨 공작 기록 1개당 15% 확률로 맞폭로
  const records = (r.pado.cover ?? 0) + r.whistle.counter;
  let backlash = '';
  for (let i = 0; i < records; i++) if (rng.next() < 0.15) { s.trust = clamp(s.trust - 20, 0, 100); backlash = ' 하지만 상대가 우리 약점을 맞폭로했습니다 (교장 신임 -20).'; break; }

  let effect = '';
  const cls = t.classId ? classById(s, t.classId) : null;
  if (venue === 'parents') {
    if (cls) { transfer(cls, cls.owner === 'player' ? 'none' : cls.owner, 'none', 30, false); effect = `${classLabel(cls.id)}의 ${FACTIONS[cls.owner].short} 지지도 -30%p.`; }
    s.trust = clamp(s.trust + 3, 0, 100);
    effect += ' 학부모들이 만족했습니다 (신임 +3).';
  } else if (venue === 'council') {
    const posts = Object.entries(s.school.postHolder).filter(([, id]) => id === t.id).map(([p]) => p);
    for (const p of posts) { placeById(s, p).owner = 'player'; s.school.postHolder[p] = 'player'; count('post'); }
    effect = posts.length ? `${posts.map((p) => POSTS[p].name).join(', ')} 자리를 박탈했고, 그 자리를 우리가 맡았습니다 (정도+내부고발자).` : '부장 자리가 없는 교사라 교무회의 경고로 끝났습니다.';
  } else {
    // 교육청: 전근. 담임 반이 공석이 되어 바로 점령
    const old = t.name;
    const used = new Set(allTeachers(s).map((x) => x.name));
    let n = '';
    for (let i = 0; i < 50 && (!n || used.has(n)); i++) n = rng.weighted(SURNAMES) + rng.pick(GIVEN);
    t.name = n; t.faction = 'none'; t.pol = rng.int(7, 12);
    for (const [p, id] of Object.entries(s.school.postHolder)) if (id === t.id) { placeById(s, p).owner = 'none'; }
    if (cls) { cls.owner = 'player'; cls.lowTurns = 0; transfer(cls, 'others', 'player', 15); count('conquer'); effect = `${old} 선생님이 전근을 갔습니다. 공석이 된 ${classLabel(cls.id)}을(를) 우리가 맡았습니다 (새 담임 ${n} 선생님, 무소속).`; }
    else effect = `${old} 선생님이 전근을 갔습니다.`;
  }
  f.sins = f.sins.filter((x) => x !== sin);
  delete f.evidence[sin];
  if (AI_FACTIONS.includes(fac)) s.school.rel[fac] = clamp((s.school.rel[fac] ?? 0) - 30, -100, 100);
  if (r.inf.unlocked) { const add = Math.round(r.inf.followers * 0.5); r.inf.followers += add; effect += ` 폭로가 콘텐츠가 되어 팔로워 +${add}.`; }
  gain(s, 'whistle', 8);
  count('expose');
  r.whistle.last = `${EXPOSE[venue].name} 폭로 성공: ${effect}${backlash}`;
  addMessage({ kind: 'info', title: `폭로 성공 (${EXPOSE[venue].name}): ${sin}`, body: `${effect}${backlash}` });
  return done(r.whistle.last);
}
