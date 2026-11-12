// 특수 루트 데이터 (룰북 12장)
export const ROUTES = {
  justice: { name: '정도', concept: '대결 4종과 교무 정치로 장악', resource: '존경 지지도', risk: '교장 신임' },
  pado: { name: '패도 (흑막 교사)', concept: '짱을 키워 싸움으로 장악', resource: '공포 지지도', risk: '열기' },
  whistle: { name: '내부고발자', concept: '비리를 폭로해 적 교사를 몰아냄', resource: '증거', risk: '보복' },
  influencer: { name: '인플루언서', concept: '학교 SNS로 여론 장악', resource: '팔로워', risk: '논란' },
  ghost: { name: '괴담', concept: '학교 7대 불가사의를 풀어 보너스 획득', resource: '단서', risk: '광기' },
};
export const TIERS = [[80, '정점'], [50, '숙련'], [20, '입문'], [0, '미숙']];
export const tierOf = (m) => TIERS.find(([v]) => m >= v)[1];

// ---------- 패도 (12.3) ----------
export const FIGHT_W = { 격투: 3, 피지컬: 2, 운동신경: 2, 맷집: 2, 승부욕: 1, 평정심: 1 };
export const FIGHT_TYPES = {
  duel1: { name: '맞짱', size: 1, ap: 2, heat: 5, desc: '1 대 1, 3라운드 2선승. 우세 85% 이상인 라운드는 30% 확률로 즉시 KO' },
  gang: { name: '패싸움', size: 5, ap: 2, heat: 10, desc: '5 대 5, 3구간. 팀 전력 × 진형 × 장소 × 지휘' },
  war: { name: '전면전', size: 15, ap: 2, heat: 20, desc: '15 대 15, 학교 짱 결정전. 지휘 보정 2배', need: 50 },
};
export const FORMATIONS = { 돌격: '포위', 포위: '매복', 매복: '돌격' }; // 왼쪽이 오른쪽을 이긴다
export const FIGHT_PLACES = {
  back: { name: '체육관 뒤', desc: '기본값', heat: 1, cmd: 1, num: 1, injury: 1 },
  roof: { name: '옥상', desc: '좁음. 인원 차 보정 절반', heat: 1, cmd: 1, num: 0.5, injury: 1 },
  field: { name: '운동장', desc: '넓음. 지휘·인원 차 보정 ×1.5, 열기 ×1.5', heat: 1.5, cmd: 1.5, num: 1.5, injury: 1 },
  alley: { name: '학교 밖 뒷골목', desc: '열기 ×0.5, 부상 확률 ×1.5', heat: 0.5, cmd: 1, num: 1, injury: 1.5 },
  lounge: { name: '현제관 휴게실', desc: '기숙사 안, 밤에만. 사감 관계 30 미만이면 발각 +10%p', heat: 1, cmd: 1, num: 1, injury: 1, night: true },
};
export const FIGHT_LINES = {
  win: ['기세에서 밀리지 않았다', '한 박자 빠른 필살기 컷!', '눈빛만으로 상대를 눌렀다', '뒤에서 친구들의 함성이 터졌다'],
  lose: ['기세가 한풀 꺾였다', '상대의 필살기가 먼저 들어갔다', '발이 묶였다', '숨을 고르며 물러섰다'],
};

// ---------- 내부고발자 (12.4) ----------
export const CORRUPTION = ['성적 조작', '부당한 체벌', '예산 유용', '출결 조작'];
export const PROBES = {
  tip: { name: '학생 제보 받기', ap: 1, desc: '+10~20% (담임반 학생의 친화력·결속도)' },
  docs: { name: '서류 확인', ap: 2, desc: '+15~25% (교사 행정력, 교무부장이면 +10%p)' },
  witness: { name: '목격자 확보', ap: 1, desc: '+10% (학생의 기억력·논리력)' },
};
export const EXPOSE = {
  parents: { name: '학부모회', need: 50, desc: '그 교사 반의 담임 계파 지지도 -30%p' },
  council: { name: '교무회의', need: 60, desc: '그 교사의 부장 자리 박탈 (공석이 되면 우리가 바로 차지)' },
  office: { name: '교육청', need: 80, desc: '그 교사 전근. 담임 반이 공석이 되어 바로 점령 가능' },
};
export const EXPOSE_AP = 3;

// ---------- 인플루언서 (12.5) ----------
export const CONCEPTS = {
  daily: { name: '일상', mult: 1.0, ctrv: 0 },
  challenge: { name: '챌린지', mult: 1.3, ctrv: 3 },
  study: { name: '공부법', mult: 0.8, ctrv: 0, parents: true },
  expose: { name: '폭로성', mult: 2.0, ctrv: 15 },
  ghost: { name: '괴담', mult: 2.0, ctrv: 0, ghost: true },
};
export const FOLLOWER_TIERS = [[20000, 25], [5000, 15], [2000, 10], [500, 5], [0, 0]];
export const followerBonus = (f) => FOLLOWER_TIERS.find(([v]) => f >= v)[1];

// ---------- 괴담 (12.6) ----------
export const MYSTERIES = [
  { id: 'piano', name: '밤의 음악실 피아노', need: 35, reward: '창의성 성장 +20%' },
  { id: 'library', name: '도서관 금지 서고', need: 40, reward: '기억력·이해력 성장 +15%' },
  { id: 'roof', name: '옥상의 그림자', need: 30, reward: '학생 포섭 성공률 +10%p' },
  { id: 'basement', name: '현제관 지하실 (C동 지하의 ???)', need: 50, reward: '신체 스탯 성장 +15%' },
  { id: 'skull', name: '과학실 해골', need: 45, reward: '대결 불운 이벤트 확률 -20%' },
  { id: 'portrait', name: '교장실 초상화', need: 55, reward: '교장 신임 하락폭 -25%' },
  { id: 'thirteen', name: '13번째 교실', need: 60, reward: '진엔딩 "학교의 숨겨진 진실"', last: true },
];
// 조사 도중 선택지 퍼즐 (단서가 절반을 넘으면 한 번)
export const PUZZLES = {
  piano: ['아무도 없는 음악실에서 피아노가 혼자 울립니다. 악보에는 반쯤 지워진 학생 이름이 적혀 있습니다.', '악보를 끝까지 연주해 본다', '이름을 졸업 앨범에서 찾아본다'],
  library: ['금지 서고 맨 아래 칸에 1987년 대출 카드가 끼워진 책이 있습니다.', '책을 몰래 빌려 나온다', '대출 카드의 이름만 적어 둔다'],
  roof: ['옥상 물탱크 옆에 매일 같은 시각 그림자가 섭니다. 그림자는 운동장을 내려다봅니다.', '그림자가 서는 자리에 서 본다', '그림자가 보는 곳을 망원경으로 본다'],
  basement: ['C동 지하실 문 너머에서 오래된 라디오 소리가 들립니다.', '문을 열고 들어간다', '라디오 주파수를 적어 온다'],
  skull: ['과학실 해골의 손가락이 밤마다 다른 방향을 가리킵니다.', '가리키는 곳을 따라가 본다', '일주일 치 방향을 기록한다'],
  portrait: ['교장실 초상화의 눈이 시계 방향으로 조금씩 돌아가 있습니다.', '초상화 뒤를 살짝 들춰 본다', '역대 교장 명단과 비교한다'],
  thirteen: ['존재하지 않는 13번째 교실의 문이 복도 끝에 나타났습니다. 칠판에 오늘 날짜가 적혀 있습니다.', '교실에 들어가 출석을 부른다', '문 앞에서 기다린다'],
};

// ---------- 엔딩 (12.8) ----------
export const ENDINGS = {
  'justice': '명문 교장',
  'pado': '흑막 교장',
  'justice+pado': '전설의 선생님 (둘 다 정점일 때)',
  'justice+whistle': '청렴한 개혁 교장',
  'influencer+justice': '전국구 명문',
  'influencer+pado': '거리의 전설',
  'pado+whistle': '두 얼굴의 교장',
  'influencer+whistle': '국민 교사',
};
