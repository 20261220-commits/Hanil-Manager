// 체격: 키·몸무게와 포지션별 체격 보정
// 고등학생 남자 기준 (1학년 평균 키 약 172cm, 학년마다 +1.5cm, 표준편차 약 5.5cm)
import { makeRng, clamp } from './rng.js';

const hash = (str) => [...String(str)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 2147483647, 7);

// 학생마다 이름과 학년으로 정해지는 키·몸무게 (저장하지 않은 다른 반 학생도 늘 같은 값)
export function rollBody(st) {
  const rng = makeRng(hash(`${st.name}|${st.id}|body`));
  const phy = st.stats?.['피지컬'] ?? 9;
  const h = Math.round(clamp(170.5 + ((st.grade ?? 1) - 1) * 1.5 + rng.gauss() * 5.5 + (phy - 9) * 0.6, 156, 197));
  const bmi = clamp(21.8 + rng.gauss() * 2.1 + (phy - 9) * 0.35, 17, 31);
  return { h, w: Math.round(bmi * (h / 100) ** 2) };
}

export function bodyOf(st) {
  if (st.h && st.w) return { h: st.h, w: st.w };
  return rollBody(st);
}

export const bmiOf = (b) => b.w / (b.h / 100) ** 2;
export function bodyType(b) {
  const x = bmiOf(b);
  return x < 18.5 ? '마른 편' : x < 22 ? '보통' : x < 24.5 ? '다부진 편' : x < 27 ? '큰 체격' : '육중함';
}

// 포지션별 체격 보정 (스탯 단위로 적합도에 더한다): 키 173cm, 몸무게 65kg 기준
const BODY_FIT = {
  GK: { h: 0.1 }, DF: { h: 0.05, w: 0.03 }, FW: { h: 0.02 },
  PG: { h: -0.03 }, SG: { h: 0.04 }, SF: { h: 0.08 }, PF: { h: 0.12, w: 0.03 }, C: { h: 0.16, w: 0.04 },
  P: { h: 0.06 }, RP: { h: 0.06 }, CA: { w: 0.05 }, '1B': { h: 0.05, w: 0.02 }, BAT: { w: 0.04, h: 0.02 },
  // 행사 무대·토론 등은 체격과 상관없음
};
// 몸이 무거우면 많이 뛰는 자리가 불리하다 (BMI 26 넘으면)
const AGILE = new Set(['MF', 'FW', 'PG', 'SG', 'SS', 'CF', '2B']);

export function bodyBonus(st, pos) {
  const b = bodyOf(st);
  const c = BODY_FIT[pos];
  let v = 0;
  if (c) v += (c.h ?? 0) * (b.h - 173) + (c.w ?? 0) * (b.w - 65);
  if (AGILE.has(pos) && bmiOf(b) > 26) v -= (bmiOf(b) - 26) * 0.3;
  return clamp(v, -2.5, 2.5);
}

// 싸움(패도): 체급 보정 (몸무게 65kg 기준)
export const weightClassBonus = (st) => clamp((bodyOf(st).w - 65) * 0.05, -2, 2);

// 진급하면 키·몸무게가 조금 자란다
export function growBody(c, rng, fromGrade) {
  const b = bodyOf({ ...c, name: c.n ?? c.name, stats: c.stats });
  const dh = fromGrade === 1 ? rng.int(0, 3) : rng.int(0, 1);
  return { h: b.h + dh, w: b.w + rng.int(0, 3) + Math.round(dh * 0.5) };
}
