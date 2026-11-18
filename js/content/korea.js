// 2막 전국 맵 (룰북 11.0): 남한 윤곽, 권역, 학교 96곳
// 위치는 실제 위도·경도를 대략 옮긴 것이다. 학교 분류는 게임용이고, 교사·교장은 모두 가상의 인물이다.

export const REGIONS = {
  capital: { name: '수도권', adj: ['chung', 'gangwon'] },
  gangwon: { name: '강원권', adj: ['capital', 'chung', 'yeong'] },
  chung: { name: '충청권', adj: ['capital', 'gangwon', 'honam', 'yeong'] },
  honam: { name: '호남권', adj: ['chung', 'yeong', 'jeju'] },
  yeong: { name: '영남권', adj: ['chung', 'gangwon', 'honam'] },
  jeju: { name: '제주권', adj: ['honam'] },
};
export const HOME_REGION = 'chung';

// 위경도 → 권역 (도 경계를 대략 직선으로 나눔)
export function regionAt(lat, lon) {
  if (lat < 33.8) return 'jeju';
  if (lat >= 36.95 && lon <= 127.72) return 'capital';
  if (lat >= 37.05 && lon > 127.72) return 'gangwon';
  if (lat >= 36.0 && lon < 128.05) return 'chung';
  if (lat < 36.0 && lon < 127.72) return 'honam';
  return 'yeong';
}

// 남한 본토 윤곽 (경도, 위도)
export const OUTLINE = [
  [126.5, 37.75], [126.7, 37.95], [127.1, 38.3], [127.6, 38.3], [128.1, 38.35], [128.35, 38.62], [128.62, 38.2], [128.92, 37.8],
  [129.2, 37.42], [129.42, 37.0], [129.47, 36.5], [129.42, 36.05], [129.6, 36.0], [129.47, 35.5], [129.27, 35.25], [129.08, 35.05],
  [128.6, 34.88], [128.2, 34.83], [127.8, 34.68], [127.4, 34.58], [127.0, 34.42], [126.6, 34.28], [126.28, 34.5], [126.33, 34.8],
  [126.38, 35.12], [126.48, 35.5], [126.68, 35.92], [126.52, 36.22], [126.12, 36.72], [126.38, 37.02], [126.6, 37.22], [126.52, 37.5],
];
export const JEJU_BOX = { lat: [33.2, 33.62], lon: [126.1, 127.0] };

// 헥스: 한 칸 약 25km (위도 0.2°, 경도 0.28°), 홀수 행은 반 칸 오른쪽
export const HEX = { lat0: 38.65, lon0: 126.0, dLat: 0.2, dLon: 0.28 };

// 한일고 (본교)
export const HOME = { name: '한일고', city: '공주', lat: 36.43, lon: 127.0 };

// tier: boss 전국 명문(자존심 200) · regional 지역 명문(150)
// line: sci 과학고·영재학교 · lang 외고·국제고 · art 예고·국악고 · elite 사립 명문 · gen 일반고 명문 · pe 체육 특화
// girls: 여고 (연애 해금 조건, 2막 다음 단계에서)
const S = (name, region, tier, line, city, lat, lon, girls = false) => ({ name, region, tier, line, city, lat, lon, girls });
export const SCHOOLS = [
  // 전국 명문 (보스)
  S('용인외대부고', 'capital', 'boss', 'lang', '용인', 37.24, 127.18),
  S('서울과학고', 'capital', 'boss', 'sci', '서울 종로', 37.58, 127.0),
  S('경기과학고', 'capital', 'boss', 'sci', '수원', 37.29, 127.0),
  S('하나고', 'capital', 'boss', 'elite', '서울 은평', 37.63, 126.93),
  S('대원외고', 'capital', 'boss', 'lang', '서울 광진', 37.55, 127.08),
  S('서울예고', 'capital', 'boss', 'art', '서울 종로', 37.6, 126.96),
  S('민족사관고', 'gangwon', 'boss', 'elite', '횡성', 37.5, 128.0),
  S('천안북일고', 'chung', 'boss', 'pe', '천안', 36.82, 127.15),
  S('대전과학고', 'chung', 'boss', 'sci', '대전', 36.37, 127.36),
  S('상산고', 'honam', 'boss', 'elite', '전주', 35.82, 127.1),
  S('광주과학고', 'honam', 'boss', 'sci', '광주', 35.2, 126.85),
  S('한국과학영재학교', 'yeong', 'boss', 'sci', '부산', 35.17, 129.07),
  S('포항제철고', 'yeong', 'boss', 'elite', '포항', 36.0, 129.36),
  S('현대청운고', 'yeong', 'boss', 'elite', '울산', 35.55, 129.32),
  // 수도권 지역 명문
  S('한성과학고', 'capital', 'regional', 'sci', '서울 서대문', 37.57, 126.95),
  S('인천과학예술영재학교', 'capital', 'regional', 'sci', '인천', 37.38, 126.66),
  S('경기외고', 'capital', 'regional', 'lang', '의왕', 37.35, 126.97),
  S('고양외고', 'capital', 'regional', 'lang', '고양', 37.66, 126.78),
  S('대일외고', 'capital', 'regional', 'lang', '서울 성북', 37.6, 127.03),
  S('명덕외고', 'capital', 'regional', 'lang', '서울 강서', 37.56, 126.84),
  S('안양외고', 'capital', 'regional', 'lang', '안양', 37.4, 126.92),
  S('한영외고', 'capital', 'regional', 'lang', '서울 강동', 37.54, 127.13),
  S('수원외고', 'capital', 'regional', 'lang', '수원', 37.28, 127.03),
  S('성남외고', 'capital', 'regional', 'lang', '성남', 37.42, 127.13),
  S('과천외고', 'capital', 'regional', 'lang', '과천', 37.43, 126.99),
  S('서울국제고', 'capital', 'regional', 'lang', '서울 종로', 37.59, 126.97),
  S('청심국제고', 'capital', 'regional', 'lang', '가평', 37.74, 127.42),
  S('동탄국제고', 'capital', 'regional', 'lang', '화성', 37.2, 127.07),
  S('고양국제고', 'capital', 'regional', 'lang', '고양', 37.67, 126.77),
  S('선화예고', 'capital', 'regional', 'art', '서울 광진', 37.55, 127.08),
  S('국립국악고', 'capital', 'regional', 'art', '서울 강남', 37.49, 127.07),
  S('계원예고', 'capital', 'regional', 'art', '성남', 37.43, 127.13),
  S('덕원예고', 'capital', 'regional', 'art', '서울 강서', 37.55, 126.85),
  S('안양예고', 'capital', 'regional', 'art', '안양', 37.39, 126.93),
  S('휘문고', 'capital', 'regional', 'elite', '서울 강남', 37.5, 127.06),
  S('단대부고', 'capital', 'regional', 'elite', '서울 강남', 37.49, 127.07),
  S('세화고', 'capital', 'regional', 'elite', '서울 서초', 37.5, 127.0),
  S('세화여고', 'capital', 'regional', 'elite', '서울 서초', 37.5, 127.0, true),
  S('중앙고', 'capital', 'regional', 'elite', '서울 종로', 37.58, 126.99),
  S('중동고', 'capital', 'regional', 'elite', '서울 강남', 37.49, 127.08),
  S('배재고', 'capital', 'regional', 'elite', '서울 강동', 37.54, 127.15),
  S('양정고', 'capital', 'regional', 'elite', '서울 양천', 37.52, 126.87),
  S('보인고', 'capital', 'regional', 'elite', '서울 송파', 37.5, 127.12),
  S('이화여대사대부고', 'capital', 'regional', 'elite', '서울 서대문', 37.56, 126.94, true),
  S('선덕고', 'capital', 'regional', 'elite', '서울 도봉', 37.66, 127.04),
  S('한민고', 'capital', 'regional', 'elite', '파주', 37.82, 126.85),
  S('안산동산고', 'capital', 'regional', 'elite', '안산', 37.32, 126.83),
  S('인천하늘고', 'capital', 'regional', 'elite', '인천 영종', 37.49, 126.49),
  S('강서고', 'capital', 'regional', 'gen', '서울 강서', 37.55, 126.85),
  S('은광여고', 'capital', 'regional', 'gen', '서울 강남', 37.49, 127.06, true),
  S('숙명여고', 'capital', 'regional', 'gen', '서울 강남', 37.49, 127.05, true),
  S('경기여고', 'capital', 'regional', 'gen', '서울 강남', 37.49, 127.05, true),
  S('현대고', 'capital', 'regional', 'gen', '서울 강남', 37.52, 127.02),
  S('중산고', 'capital', 'regional', 'gen', '서울 강남', 37.49, 127.08),
  S('상문고', 'capital', 'regional', 'gen', '서울 서초', 37.48, 127.01),
  S('반포고', 'capital', 'regional', 'gen', '서울 서초', 37.5, 127.0),
  S('한영고', 'capital', 'regional', 'gen', '서울 강동', 37.54, 127.13),
  S('광남고', 'capital', 'regional', 'gen', '서울 광진', 37.54, 127.09),
  S('대진고', 'capital', 'regional', 'gen', '서울 노원', 37.66, 127.06),
  S('서라벌고', 'capital', 'regional', 'gen', '서울 성북', 37.6, 127.02),
  S('신목고', 'capital', 'regional', 'gen', '서울 양천', 37.53, 126.87),
  S('양재고', 'capital', 'regional', 'gen', '서울 서초', 37.47, 127.04),
  S('영동고', 'capital', 'regional', 'gen', '서울 강남', 37.5, 127.05),
  S('잠신고', 'capital', 'regional', 'gen', '서울 송파', 37.51, 127.08),
  S('창덕여고', 'capital', 'regional', 'gen', '서울 중구', 37.57, 126.97, true),
  S('한대부고', 'capital', 'regional', 'gen', '서울 성동', 37.56, 127.04),
  S('진선여고', 'capital', 'regional', 'gen', '서울 강남', 37.49, 127.05, true),
  S('낙생고', 'capital', 'regional', 'gen', '성남', 37.37, 127.11),
  S('운정고', 'capital', 'regional', 'gen', '파주', 37.72, 126.75),
  S('화성고', 'capital', 'regional', 'gen', '화성', 37.2, 126.83),
  S('보정고', 'capital', 'regional', 'gen', '용인', 37.31, 127.11),
  S('부천고', 'capital', 'regional', 'gen', '부천', 37.5, 126.78),
  S('분당중앙고', 'capital', 'regional', 'gen', '성남', 37.37, 127.12),
  S('수내고', 'capital', 'regional', 'gen', '성남', 37.38, 127.12),
  S('양서고', 'capital', 'regional', 'gen', '양평', 37.52, 127.37),
  S('일산대진고', 'capital', 'regional', 'gen', '고양', 37.67, 126.76),
  S('정발고', 'capital', 'regional', 'gen', '고양', 37.66, 126.77),
  // 충청권
  S('세종과학고', 'chung', 'regional', 'sci', '세종', 36.5, 127.26),
  S('세종과학예술영재학교', 'chung', 'regional', 'sci', '세종', 36.5, 127.27),
  S('대전외고', 'chung', 'regional', 'lang', '대전', 36.35, 127.38),
  S('대전대성고', 'chung', 'regional', 'elite', '대전', 36.32, 127.42),
  S('충남삼성고', 'chung', 'regional', 'elite', '아산', 36.78, 127.0),
  S('공주사대부고', 'chung', 'regional', 'gen', '공주', 36.45, 127.12),
  S('대전고', 'chung', 'regional', 'gen', '대전', 36.33, 127.43),
  // 호남권
  S('광양제철고', 'honam', 'regional', 'elite', '광양', 34.94, 127.7),
  S('남성고', 'honam', 'regional', 'elite', '익산', 35.95, 126.96),
  // 영남권
  S('대구과학고', 'yeong', 'regional', 'sci', '대구', 35.88, 128.6),
  S('부산외고', 'yeong', 'regional', 'lang', '부산', 35.2, 129.08),
  S('부산국제고', 'yeong', 'regional', 'lang', '부산', 35.12, 129.04),
  S('대구외고', 'yeong', 'regional', 'lang', '대구', 35.85, 128.55),
  S('김천고', 'yeong', 'regional', 'elite', '김천', 36.12, 128.11),
  S('능인고', 'yeong', 'regional', 'elite', '대구', 35.84, 128.62),
  S('경신고', 'yeong', 'regional', 'elite', '대구', 35.85, 128.63),
  S('경북고', 'yeong', 'regional', 'gen', '대구', 35.86, 128.6),
  // 제주권
  S('제주제일고', 'jeju', 'regional', 'gen', '제주', 33.5, 126.53),
  S('대기고', 'jeju', 'regional', 'gen', '제주', 33.51, 126.56),
].map((x, i) => ({ id: `n${String(i + 1).padStart(2, '0')}`, ...x }));

export const TIERS = { boss: { name: '전국 명문', pride: 200, bonus: 4 }, regional: { name: '지역 명문', pride: 150, bonus: 2 }, normal: { name: '일반고', pride: 100, bonus: 0 } };
// 계열 강점 (보스는 1.5배): 종목별 팀 전력 보정
export const LINES = {
  sci: { name: '과학고·영재학교', strong: { debate: 0.1 }, note: '시험(수학·탐구), 토론 강세' },
  lang: { name: '외고·국제고', strong: { debate: 0.1 }, note: '시험(국어·영어), 토론 강세' },
  art: { name: '예고·국악고', strong: { event: 0.15 }, note: '행사 기획 강세' },
  elite: { name: '사립 명문', strong: { soccer: 0.03, basketball: 0.03, baseball: 0.03, debate: 0.03, event: 0.03 }, note: '전 종목 고르게 강함' },
  gen: { name: '일반고 명문', strong: {}, note: '시험 강세, 학생 수 많음' },
  pe: { name: '체육 특화', strong: { soccer: 0.1, basketball: 0.1, baseball: 0.1 }, note: '반 대항전·싸움 강세' },
};
// 대결 결과별 자존심 피해 (9.6): 압승 -30, 승리 -20, 신승 -10
export const PRIDE_HIT = { rout: 30, win: 20, close: 10 };
