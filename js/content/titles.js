// 교사 칭호: 플레이하면서 얻고, 얻은 칭호 중 하나를 골라 이름 앞에 붙인다.
// check(state)가 참이 되면 그 주의 정산에서 얻는다.
export const TITLES = [
  { name: '새내기', how: '처음부터 가지고 있음', check: () => true },
  { name: '상담왕', how: '상담을 20번 성공', check: (s) => (s.counters.counselOK ?? 0) >= 20 },
  { name: '원석 발굴가', how: '학생 관찰로 숨은 원석(포텐 -8 이상)을 찾음', check: (s) => (s.counters.gemFound ?? 0) >= 1 },
  { name: '훈화 장인', how: '훈화 한 번으로 10명 이상의 사기를 올림', check: (s) => (s.counters.bigTalk ?? 0) >= 1 },
  { name: '야근 요정', how: '야근을 10번', check: (s) => (s.counters.overtime ?? 0) >= 10 },
  { name: '학생 편', how: '일탈한 학생을 10번 감쌈', check: (s) => (s.counters.cover ?? 0) >= 10 },
  { name: '라면 단속반', how: '일탈한 학생에게 벌점이나 꾸중을 10번', check: (s) => (s.counters.strict ?? 0) >= 10 },
  { name: '승부사', how: '다른 반과의 대결에서 5번 이김', check: (s) => (s.counters.duelWin ?? 0) >= 5 },
  { name: '정복자', how: '다른 반을 처음으로 점령', check: (s) => (s.counters.conquer ?? 0) >= 1 },
  { name: '한 학기 생존자', how: '1학기를 끝까지 버팀 (여름방학 도달)', check: (s) => s.turn >= 21 },
];

export const titleByName = (n) => TITLES.find((t) => t.name === n);
