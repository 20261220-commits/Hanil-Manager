// 학사 달력 (룰북 3.1~3.2). 1턴 = 1주. 한 달을 4주로 단순화한다.
// 1학기 1~20턴(3~7월), 여름방학 21~24턴(8월).

const EVENTS = {
  1: '입학식',
  2: '학급 임원 선거',
  8: '중간고사',
  10: '체육대회',
  17: '기말고사',
  20: '학기 평가',
  31: '2학기 중간고사',
  39: '2학기 기말고사',
};

export function weekLabel(turn) {
  const month = 3 + Math.floor((turn - 1) / 4);
  const week = ((turn - 1) % 4) + 1;
  const tail = EVENTS[turn] ? ` (${EVENTS[turn]})` : turn >= 21 && turn <= 24 ? ' (여름방학)' : '';
  return `${month}월 ${week}주${tail}`;
}

export const eventOf = (turn) => EVENTS[turn] ?? null;

// 시험 직전 3주는 성적 불안이 두 배로 오른다.
export const nearExam = (turn) => [6, 7, 8, 15, 16, 17, 29, 30, 31, 37, 38, 39].includes(turn);

// 월 1회 금요일 귀성 (룰북 13.2): 매달 4주째 주말
export const isHomecoming = (turn) => turn % 4 === 0;

export const isVacation = (turn) => turn >= 21 && turn <= 24;
