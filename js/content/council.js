// 교무회의 안건과 학교 규칙 (룰북 3.5 교무회의 안건 발의: 장소 담당권, 예산, 규칙 변경 투표)

// 학교 규칙: 통과되면 켜지고, 폐지 안건이 통과되면 꺼진다.
// pref: 계파별 찬성 성향 (-0.4 ~ +0.4). 폐지 안건에서는 부호가 바뀐다.
export const SCHOOL_RULES = [
  { id: 'phone', name: '휴대폰 사용 시간 연장', desc: '귀가 욕구가 오르는 속도 -30%',
    pref: { elder: -0.3, exam: -0.1, pe: 0.1, innov: 0.25, none: 0.05 } },
  { id: 'snack', name: '기숙사 야식 허용', desc: '식욕이 오르는 속도 -30%',
    pref: { elder: -0.25, exam: 0, pe: 0.2, innov: 0.2, none: 0.1 } },
  { id: 'study', name: '야간 자율학습 강화', desc: '지적 성장 +10%, 놀고 싶은 욕구·성적 불안이 오르는 속도 +20%',
    pref: { elder: 0.2, exam: 0.35, pe: -0.3, innov: -0.2, none: 0 } },
  { id: 'sports', name: '점심시간 운동장 개방', desc: '신체 성장 +10%, 놀고 싶은 욕구가 오르는 속도 -15%',
    pref: { elder: -0.1, exam: -0.25, pe: 0.35, innov: 0.1, none: 0.05 } },
];
export const ruleById = (id) => SCHOOL_RULES.find((r) => r.id === id);

// 부장 자리 효과 (룰북 8.1). 부장 자리를 가지면 AP도 늘어난다 (3.4: 1개 6, 2개 이상 7).
export const POSTS = {
  dean: { name: '교무부장', effect: '담당 수업 반을 고를 수 있음 (학기마다 1번)' },
  discipline: { name: '학생부장', effect: '벌점을 줘도 학생 사기가 떨어지지 않음' },
  research: { name: '연구부장', effect: '시험 출제 경향 힌트 (시험 대결과 함께 추가 예정)' },
  career: { name: '진로부장', effect: '매주 담임반 학생 명성 경험치 +3' },
};

// 특별실 담당권 효과 (룰북 8.1 특별실 보너스). 플레이어가 가졌을 때 담임반 성장에 적용한다.
export const ROOM_GROWTH = {
  library: { group: 'mind', mult: 1.1, text: '지적 스탯 성장 +10%' },
  lab: { stats: ['논리력', '문제해결력'], mult: 1.2, text: '논리력·문제 해결력 성장 +20%' },
  museong: { group: 'body', mult: 1.1, text: '신체 스탯 성장 +10%' },
  music: { stats: ['창의성'], mult: 1.15, text: '창의성 성장 +15%' },
  art: { stats: ['창의성'], mult: 1.15, text: '창의성 성장 +15%' },
};

export const AGENDA_KIND = {
  room: '장소 담당권',
  rule: '규칙 변경',
  noconf: '부장 불신임',
  budget: '학급 운영비 증액',
};

// 불신임 안건을 올릴 자격 (룰북: 부장 자리는 정치력 + 실적)
export const NOCONF_NEED = { trust: 55, classes: 2, wins: 3 };
