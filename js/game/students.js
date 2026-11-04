// 학생 생성 (룰북 4장, 8.0절 담임반 규칙)
import { STATS, NEEDS, LUCK, POTENTIAL_TIERS } from '../content/stats.js';
import { PERSONALITIES } from '../content/personality.js';
import { TRAITS, RARITY_P } from '../content/traits.js';
import { SURNAMES, GIVEN } from '../content/names.js';
import { clamp } from './rng.js';

// 현재 능력(CA): 공개 스탯 평균 1당 10. 평균 8이면 50, 평균 20이면 170.
export function calcCA(stats) {
  const avg = STATS.reduce((s, k) => s + stats[k], 0) / STATS.length;
  return clamp(Math.round((avg - 3) * 10), 1, 200);
}

function rollPotential(rng, tiers = POTENTIAL_TIERS) {
  const tier = rng.weighted(tiers.map((t) => [t, t[3]]));
  return { tier: tier[0], pa: rng.int(tier[1], tier[2]) };
}

function rollTrait(rng) {
  return rng.weighted(TRAITS.map((t) => [t.name, RARITY_P[t.rarity]]));
}

function uniqueName(rng, used) {
  for (let i = 0; i < 200; i++) {
    const name = rng.weighted(SURNAMES) + rng.pick(GIVEN);
    if (!used.has(name)) { used.add(name); return name; }
  }
  return rng.weighted(SURNAMES) + rng.pick(GIVEN);
}

// 1학년 학생 한 명. 공개 스탯은 5~12 (룰북 8.0)
function makeFreshman(rng, used, opts = {}) {
  const base = opts.base ?? 6 + rng.next() * 4;
  const stats = {};
  for (const k of STATS) stats[k] = clamp(Math.round(base + rng.gauss() * 1.8), 5, 12);
  if (opts.leader) stats['통솔'] = rng.int(12, 13);

  const personality = rng.pick(PERSONALITIES).name;
  const trait = opts.trait ?? rollTrait(rng);
  const ca = calcCA(stats);
  const pot = opts.gem
    ? rollPotential(rng, POTENTIAL_TIERS.filter((t) => ['-10', '-9', '-8'].includes(t[0])))
    : rollPotential(rng);
  const pa = Math.max(pot.pa, ca + rng.int(3, 10));

  const needs = {};
  for (const n of NEEDS) needs[n.key] = 0;
  needs.play = rng.int(5, 25);
  needs.home = rng.int(20, 45) * (personality === '외로움 탐' ? 1.5 : 1);
  needs.grade = rng.int(5, 20);
  needs.food = rng.int(10, 30);
  needs.recog = rng.int(5, 20);
  for (const k in needs) needs[k] = clamp(Math.round(needs[k]), 0, 100);

  return {
    name: uniqueName(rng, used),
    grade: 1,
    stats,
    personality,
    trait,
    ca,
    pa,
    potTier: pot.tier,
    luck: rng.weighted([['빨', 10], ['주', 20], ['노', 40], ['연', 20], ['초', 10]]),
    morale: rng.weighted([['약간 낮음', 15], ['보통', 60], ['약간 높음', 25]]),
    condition: 100,
    needs,
    bond: clamp(Math.round(50 + rng.gauss() * 8), 30, 70),
    fameExp: 0,
    faction: 'player',
    tags: opts.tags ?? [],
    observed: false,
    estimate: null,
  };
}

const DORM_ROOMS = ['1F-101', '1F-102', '1F-103', '1F-104', '1F-105', '1F-106', '2F-201', '2F-202'];

// 담임반 30명: 숨은 원석, 리더 후보, 문제아가 반드시 1명씩 있다.
export function makeHomeroom(rng, size = 30) {
  const used = new Set();
  const students = [
    makeFreshman(rng, used, { gem: true, base: 7 + rng.next() * 1.5, tags: ['gem'] }),
    makeFreshman(rng, used, { leader: true, tags: ['leader'] }),
    makeFreshman(rng, used, { trait: '트러블 메이커', tags: ['trouble'] }),
  ];
  while (students.length < size) students.push(makeFreshman(rng, used));

  // 번호는 이름 가나다순, 호실은 섞어서 4명씩
  const ordered = rng.shuffle(students).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  ordered.forEach((s, i) => { s.id = `s${String(i + 1).padStart(2, '0')}`; s.no = i + 1; });
  rng.shuffle(ordered).forEach((s, i) => { s.room = DORM_ROOMS[Math.floor(i / 4)] ?? DORM_ROOMS[DORM_ROOMS.length - 1]; });
  return ordered;
}

// 학생 관찰 (룰북 4.4): 교사 안목이 낮을수록 포텐 추정 범위가 넓고 부정확하다.
export function observe(rng, student, eye) {
  const width = Math.max(6, (20 - eye) * 2.5);
  const center = student.pa + rng.gauss() * width * 0.35;
  student.estimate = {
    low: clamp(Math.round(center - width / 2), 1, 200),
    high: clamp(Math.round(center + width / 2), 1, 200),
  };
  student.observed = true;
}

export const needLevel = (s) => Math.max(...Object.values(s.needs));
export const topNeed = (s) => Object.entries(s.needs).sort((a, b) => b[1] - a[1])[0][0];
export const luckIndex = (l) => LUCK.indexOf(l);
