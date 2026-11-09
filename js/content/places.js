// 반 말고 점령할 수 있는 곳 (룰북 8.0 초기 영토, 8.1 타일 종류)
// kind: outdoor 야외 구역(대결로 점령) · special 특별실(교무회의) · core 핵심실 · back 뒷공간 · base 거점
// building: 캠퍼스 지도의 건물 id (지도에 없는 곳은 null)
export const PLACES = [
  { id: 'field', name: '운동장', building: 'field', kind: 'outdoor', start: 'pe', venue: ['soccer', 'baseball'], bonus: '축구·야구 홈 보정' },
  { id: 'golf', name: '골프장', building: 'golf', kind: 'outdoor', start: 'pe', bonus: '대결 홈 보정' },
  { id: 'plaza', name: '광장', building: 'plaza', kind: 'outdoor', start: 'none', bonus: '대결 홈 보정' },
  { id: 'recycle', name: '분리수거장', building: null, kind: 'outdoor', start: 'none', bonus: '대결 홈 보정' },
  { id: 'museong', name: '무성관 (체육관)', building: 'museong', kind: 'special', start: 'pe', venue: ['basketball'], bonus: '신체 훈련 효율 +, 농구 홈 보정' },
  { id: 'library', name: '도서관', building: 'guksadang', kind: 'special', start: 'elder', bonus: '지적 능력 훈련 효율 +' },
  { id: 'club', name: '동아리실', building: 'guksadang', kind: 'special', start: 'innov', bonus: '학생 포섭 성공률 +' },
  { id: 'lab', name: '실험실', building: 'lab', kind: 'special', start: 'exam', bonus: '논리력·문제 해결력 훈련 +' },
  { id: 'music', name: '음악실', building: 'lifelong', kind: 'special', start: 'innov', bonus: '창의성 훈련 +, 행사 기획 보정' },
  { id: 'art', name: '미술실', building: 'lifelong', kind: 'special', start: 'innov', bonus: '창의성 훈련 +, 행사 기획 보정' },
  { id: 'broadcast', name: '방송실', building: 'audiovisual', kind: 'special', start: 'none', bonus: '인플루언서 루트 해금, 명성 경험치 +' },
  { id: 'roof', name: '옥상', building: null, kind: 'back', start: 'none', bonus: '비밀 회동: 포섭 성공률 +' },
  { id: 'dean', name: '교무부장 자리', building: 'bongwan', kind: 'core', start: 'elder', bonus: '담당 수업 반 우선 선택' },
  { id: 'discipline', name: '학생부장 자리', building: 'bongwan', kind: 'core', start: 'elder', bonus: '벌점 완화' },
  { id: 'research', name: '연구부장 자리', building: 'bongwan', kind: 'core', start: 'exam', bonus: '시험 출제 경향 힌트' },
  { id: 'career', name: '진로부장 자리', building: 'bongwan', kind: 'core', start: 'exam', bonus: '수능·진학 명성 +' },
  { id: 'principal', name: '교장실·행정실', building: 'bongwan', kind: 'core', start: 'neutral', bonus: '다른 타일을 모두 점령하면 자동 점령' },
  { id: 'sataek', name: '사택', building: 'sataek', kind: 'base', start: 'player', bonus: '플레이어 거점. 피로 회복' },
];

export const PLACE_KIND = { outdoor: '야외 구역', special: '특별실', core: '핵심실', back: '뒷공간', base: '거점' };
export const HOW_TO_TAKE = {
  outdoor: '대결에서 이기면 바로 점령',
  special: '교무실에서 장소 담당권 안건으로',
  core: '교무실에서 불신임 안건으로',
  back: '패도 싸움·괴담 (특수 루트에서)',
  base: '처음부터 우리 거점',
};

// 현제관 C동 호실 21개 중 담임반 학생이 사는 8개는 우리 것 (호실 학생 과반이 우리 계파)
export const DORM_C = { rooms: 21, ours: 8 };
