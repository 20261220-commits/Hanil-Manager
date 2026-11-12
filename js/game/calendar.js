// 학사 달력 (룰북 3.1~3.2). 1턴 = 1주. 한 달을 4주로 단순화해 1년 = 48턴.
// 1학기 1~20턴(3~7월), 여름방학 21~24턴(8월), 2학기 25~40턴(9~12월),
// 겨울방학·사전 협상 41~47턴(1월~2월 3주, 47턴 졸업식), 48턴 반 편성 회의(2월 4주). 49턴부터 다음 해.

const EVENTS = {
  1: '입학식',
  2: '학급 임원 선거',
  8: '중간고사',
  10: '체육대회',
  17: '기말고사',
  20: '학기 평가',
  31: '2학기 중간고사',
  39: '2학기 기말고사',
  41: '겨울방학 · 사전 협상',
  47: '졸업식',
  48: '반 편성 회의',
};

// 그해 안에서 몇 번째 주인지 (1~48)와 몇 년차인지 (0부터)
export const yearTurn = (turn) => ((turn - 1) % 48) + 1;
export const yearOf = (turn) => Math.floor((turn - 1) / 48);

export function weekLabel(turn) {
  const t = yearTurn(turn);
  let month = 3 + Math.floor((t - 1) / 4);
  if (month > 12) month -= 12;
  const week = ((t - 1) % 4) + 1;
  const tail = EVENTS[t] ? ` (${EVENTS[t]})` : t >= 21 && t <= 24 ? ' (여름방학)' : t >= 42 && t <= 46 ? ' (겨울방학)' : '';
  const year = yearOf(turn);
  return `${year ? `${year + 1}년차 ` : ''}${month}월 ${week}주${tail}`;
}

export const eventOf = (turn) => EVENTS[yearTurn(turn)] ?? null;

// 시험 직전 3주는 성적 불안이 두 배로 오른다.
export const nearExam = (turn) => [6, 7, 8, 15, 16, 17, 29, 30, 31, 37, 38, 39].includes(yearTurn(turn));

// 월 1회 금요일 귀성 (룰북 13.2): 매달 4주째 주말
export const isHomecoming = (turn) => turn % 4 === 0;

export const isVacation = (turn) => { const t = yearTurn(turn); return (t >= 21 && t <= 24) || (t >= 41 && t <= 48); };
