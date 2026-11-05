// 담당 과목 10개 (룰북 7.2). bonus: 시작 교사 능력치 +2
export const SUBJECTS = [
  { key: 'korean', name: '국어', train: '언어력, 이해력', strong: '토론, 국어 시험', bonus: '동기부여', effect: '해명 영상·폭로 성공률 +10%' },
  { key: 'math', name: '수학', train: '수리력, 논리력', strong: '수학 시험', bonus: '교과전문성', effect: '시험 출제 오류 확률 절반' },
  { key: 'social', name: '사회', train: '이해력, 기억력', strong: '탐구 시험', bonus: '정치력', effect: '교무회의 투표·동맹 협상 성공률 +10%' },
  { key: 'science', name: '과학', train: '논리력, 문제 해결력', strong: '탐구 시험', bonus: '안목', effect: '무한 실험 확률 절반, 갇혀도 성장량 2배' },
  { key: 'english', name: '영어', train: '언어력, 기억력', strong: '영어 시험, 토론', bonus: '상담', effect: '해외 교류 언어 장벽 기준 14 → 11' },
  { key: 'history', name: '역사', train: '기억력, 이해력', strong: '암기 과목 시험', bonus: '안목', effect: '괴담 단서 획득 +30%' },
  { key: 'info', name: '정보', train: '문제 해결력, 기획력', strong: '행사 기획', bonus: '행정력', effect: '인플루언서 조회수 ×1.2, 크롬북 보안 강화가 늦게 걸림' },
  { key: 'pe', name: '체육', train: '체력, 피지컬, 운동신경', strong: '반 대항전, 싸움', bonus: '지도력', effect: '격투 특훈을 해도 열기가 오르지 않음' },
  { key: 'music', name: '음악', train: '창의성, 평정심', strong: '행사 기획', bonus: '동기부여', effect: '행사 무대 역할 +10%, 반 단합 행사 비용 절반' },
  { key: 'art', name: '미술', train: '창의성, 기획력', strong: '행사 기획', bonus: '상담', effect: '행사 준비도 턴당 +5' },
];

export const subjectByKey = (k) => SUBJECTS.find((s) => s.key === k);

// 플레이어 만들기 전 기본 교사 능력치 (룰북 8.0: 8에서 시작 + 10포인트 배분을 미리 해 둔 값)
export const BASE_TEACHER = { 지도력: 10, 교과전문성: 9, 상담: 9, 동기부여: 9, 안목: 10, 행정력: 9, 정치력: 10 };
