// 교사 프로필(자기소개 글)로 만드는 교사 특성과 프로필 맞춤 이벤트의 규칙.
// AI가 무엇을 돌려주든 게임은 여기 있는 효과와 범위 안에서만 적용한다.
// worker/src/index.js 에도 같은 목록이 있다 (서버 쪽 1차 검사).

// 교사 특성 효과: [최소, 최대, 설명, 좋은 방향(+1/-1, 0이면 중립)]
export const TRAIT_EFFECTS = {
  지도력: [-2, 2, '지도력', 1],
  교과전문성: [-2, 2, '교과 전문성', 1],
  상담: [-2, 2, '상담', 1],
  동기부여: [-2, 2, '동기부여', 1],
  안목: [-2, 2, '안목', 1],
  행정력: [-2, 2, '행정력', 1],
  정치력: [-2, 2, '정치력', 1],
  counsel: [-10, 10, '상담 성공률 %p', 1],
  talk: [-10, 10, '훈화가 먹힐 확률 %p', 1],
  fatigue: [-30, 30, '피로가 쌓이는 속도 %', -1],
  recover: [-5, 5, '주말 피로 회복', 1],
  budget: [-2, 2, '매주 예산 (만원)', 1],
  trust: [-10, 10, '시작 교장 신임', 1],
  bond: [-10, 10, '담임반 시작 결속도', 1],
  duel: [-5, 5, '대결 교사 보정 %', 1],
  influence: [-20, 20, '담임반 일상 영향력 %', 1],
  catch: [-30, 30, '학생 일탈 발각 확률 %', 0],
};
export const TEACHER_STATS = ['지도력', '교과전문성', '상담', '동기부여', '안목', '행정력', '정치력'];

// 프로필 이벤트 효과: [최소, 최대, 설명]
export const EVENT_EFFECTS = {
  morale: [-2, 2, '사기 (단계)'],
  condition: [-20, 20, '컨디션'],
  need_play: [-30, 30, '놀고 싶은 욕구'],
  need_home: [-30, 30, '귀가 욕구'],
  need_grade: [-30, 30, '성적 불안'],
  need_food: [-30, 30, '식욕'],
  need_recog: [-30, 30, '인정 욕구'],
  bond: [-10, 10, '결속도'],
  trust: [-5, 5, '교장 신임'],
  budget: [-5, 5, '예산 (만원)'],
  fatigue: [-15, 15, '교사 피로'],
  support: [-3, 3, '담임반 지지도 %p'],
};

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const cut = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// 효과 하나의 힘: 범위 대비 비율 × 좋은 방향
const power = (e) => { const d = TRAIT_EFFECTS[e.key]; return d ? (e.value / d[1]) * d[3] : 0; };

// AI나 키워드 규칙이 만든 특성을 게임 규칙에 맞게 정리한다.
// 특성 2~5개, 특성마다 효과 1~3개, 전체 힘은 +1.5를 넘지 않게 좋은 효과를 줄인다.
export function sanitizeTraits(raw) {
  const list = (Array.isArray(raw) ? raw : []).slice(0, 5).map((t) => ({
    name: cut(t?.name, 12) || '이름 없는 특성',
    desc: cut(t?.desc, 70),
    effects: (Array.isArray(t?.effects) ? t.effects : [])
      .filter((e) => TRAIT_EFFECTS[e?.key])
      .slice(0, 3)
      .map((e) => ({ key: e.key, value: clampInt(e.value, TRAIT_EFFECTS[e.key][0], TRAIT_EFFECTS[e.key][1]) }))
      .filter((e) => e.value !== 0),
  })).filter((t) => t.effects.length);
  // 같은 효과가 여러 특성에 겹치면 합쳐서 범위를 넘지 않게 한다
  const total = {};
  for (const t of list) for (const e of t.effects) {
    const [lo, hi] = TRAIT_EFFECTS[e.key];
    const before = total[e.key] ?? 0;
    const after = Math.max(lo, Math.min(hi, before + e.value));
    e.value = after - before;
    total[e.key] = after;
  }
  for (const t of list) t.effects = t.effects.filter((e) => e.value !== 0);
  // 밸런스: 좋은 효과의 합이 너무 크면 가장 센 좋은 효과부터 줄인다
  let guard = 0;
  while (balanceOf(list) > 1.5 && guard++ < 50) {
    const strongest = list.flatMap((t) => t.effects).filter((e) => power(e) > 0).sort((a, b) => power(b) - power(a))[0];
    if (!strongest) break;
    const step = Math.sign(strongest.value);
    strongest.value -= step;
  }
  for (const t of list) t.effects = t.effects.filter((e) => e.value !== 0);
  return list.filter((t) => t.effects.length);
}

export const balanceOf = (traits) => traits.flatMap((t) => t.effects).reduce((a, e) => a + power(e), 0);

// event: true면 이벤트 효과 설명을 쓴다 (bond, trust 같은 이름이 특성 효과와 겹친다)
export function effectText(e, event = false) {
  const d = event ? EVENT_EFFECTS[e.key] : TRAIT_EFFECTS[e.key] ?? EVENT_EFFECTS[e.key];
  if (!d) return '';
  const sign = e.value > 0 ? '+' : '';
  return `${d[2]} ${sign}${e.value}`;
}
export const isGoodEffect = (e) => power(e) > 0;

// 교사끼리의 연애·성적인 이벤트는 허용하지만, 학생이 나오는 이벤트에 성적인 표현이 섞이면 버린다.
// (worker/src/index.js 에도 같은 검사가 있다)
const SEXUAL = ['섹스', '성관계', '잠자리', '야한', '키스', '애무', '알몸', '나체', '속옷', '가슴', '몸매', '유혹', '스킨십', '침대', '하룻밤', '성적', '음란', '야동', '모텔'];
const STUDENT_WORDS = ['{학생}', '학생', '제자', '반 아이', '1학년', '2학년', '3학년'];
export function studentSexual(ev) {
  const text = [ev.title, ev.body, ...(ev.choices ?? []).map((c) => c.label)].join(' ');
  const hasStudent = ev.target !== 'teacher' || STUDENT_WORDS.some((w) => text.includes(w));
  return hasStudent && SEXUAL.some((w) => text.includes(w));
}

export function sanitizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const choices = (Array.isArray(raw.choices) ? raw.choices : []).slice(0, 2).map((c) => ({
    label: cut(c?.label, 20) || '확인',
    effects: (Array.isArray(c?.effects) ? c.effects : []).filter((e) => EVENT_EFFECTS[e?.key]).slice(0, 3)
      .map((e) => ({ key: e.key, value: clampInt(e.value, EVENT_EFFECTS[e.key][0], EVENT_EFFECTS[e.key][1]) })).filter((e) => e.value !== 0),
  }));
  const title = cut(raw.title, 30), body = cut(raw.body, 220);
  if (!title || !body || !choices.length) return null;
  const ev = { title, body, target: ['class', 'student', 'teacher'].includes(raw.target) ? raw.target : 'class', choices };
  return studentSexual(ev) ? null : ev;
}

// ---------- 키워드 규칙 (AI 서버를 쓸 수 없을 때) ----------

const T = (name, desc, effects, event) => ({ name, desc, effects, event });
const E = (title, body, target, choices) => ({ title, body, target, choices });
const C = (label, effects) => ({ label, effects });

export const KEYWORD_RULES = [
  { words: ['커피', '카페인', '아메리카노', '라떼'], trait: T('카페인 의존', '커피가 있으면 버티고, 없으면 무너진다', [{ key: 'recover', value: 4 }, { key: 'budget', value: -1 }],
    E('책상 위의 커피', '아침에 출근해 보니 교무실 책상 위에 캔커피가 놓여 있습니다. 쪽지에는 "{학생} 올림"이라고 적혀 있습니다.', 'student', [C('고맙다고 말한다', [{ key: 'bond', value: 6 }, { key: 'morale', value: 1 }]), C('모른 척 마신다', [{ key: 'fatigue', value: -8 }])])) },
  { words: ['축구', '농구', '야구', '운동선수', '체대', '선수 출신', '스포츠'], trait: T('그라운드 출신', '운동장에 서면 눈빛이 달라진다', [{ key: 'duel', value: 3 }, { key: 'fatigue', value: -10 }],
    E('점심시간 미니 게임', '점심시간에 운동장을 지나가는데 반 학생들이 같이 뛰자고 부릅니다.', 'class', [C('같이 뛴다', [{ key: 'morale', value: 1 }, { key: 'fatigue', value: 8 }]), C('다음에 하자고 한다', [])])) },
  { words: ['엄격', '깐깐', '무서', '호랑이', '원칙', '규칙'], trait: T('호랑이 선생', '규칙은 규칙이다', [{ key: 'catch', value: 20 }, { key: 'talk', value: 5 }, { key: 'bond', value: -5 }],
    E('복도의 정적', '선생님이 복도에 나타나자 떠들던 학생들이 한순간에 조용해졌습니다.', 'class', [C('한마디 한다', [{ key: 'need_play', value: 10 }, { key: 'trust', value: 2 }]), C('웃으며 지나간다', [{ key: 'bond', value: 3 }])])) },
  { words: ['다정', '친절', '따뜻', '고민', '상냥', '잘 들어'], trait: T('들어주는 사람', '학생 이야기를 끝까지 듣는다', [{ key: 'counsel', value: 8 }, { key: 'catch', value: -10 }],
    E('늦은 밤 노크', '밤 10시, 사택 문을 두드리는 소리가 납니다. {학생}이(가) 할 말이 있다고 합니다.', 'student', [C('들어 준다', [{ key: 'need_recog', value: -20 }, { key: 'morale', value: 1 }, { key: 'fatigue', value: 6 }]), C('내일 이야기하자고 한다', [{ key: 'morale', value: -1 }])])) },
  { words: ['잠', '늦잠', '지각', '아침', '졸'], trait: T('아침잠 대장', '1교시는 늘 위기다', [{ key: 'recover', value: 3 }, { key: 'trust', value: -5 }],
    E('1교시 지각', '알람을 못 들었습니다. 1교시 종이 울릴 때 교실로 뛰어 들어갔습니다.', 'teacher', [C('솔직하게 사과한다', [{ key: 'trust', value: -2 }, { key: 'bond', value: 3 }]), C('조용히 넘어간다', [{ key: 'trust', value: -3 }])])) },
  { words: ['게임', '덕후', '오타쿠', '애니', '만화'], trait: T('게임하는 쌤', '학생들이 하는 게임을 다 안다', [{ key: 'bond', value: 6 }, { key: '안목', value: 1 }, { key: 'catch', value: -10 }],
    E('랭킹전 소문', '선생님이 학생들 사이에서 유행하는 게임 랭커라는 소문이 퍼졌습니다.', 'class', [C('인정한다', [{ key: 'bond', value: 5 }, { key: 'need_play', value: 10 }]), C('부인한다', [])])) },
  { words: ['책', '독서', '문학', '시인', '글'], trait: T('책벌레', '교무실 책상에 책이 쌓여 있다', [{ key: '교과전문성', value: 1 }, { key: 'talk', value: 4 }],
    E('추천 도서', '{학생}이(가) 읽을 만한 책을 추천해 달라고 합니다.', 'student', [C('아끼는 책을 빌려준다', [{ key: 'need_grade', value: -10 }, { key: 'morale', value: 1 }])])) },
  { words: ['수학', '계산', '숫자', '공식', '덕질'], trait: T('수식 애호가', '모든 문제를 식으로 푼다', [{ key: '교과전문성', value: 1 }, { key: '행정력', value: 1 }, { key: 'talk', value: -4 }]) },
  { words: ['술', '회식', '맥주', '소주'], trait: T('회식 체질', '교무실 회식의 분위기 메이커', [{ key: '정치력', value: 1 }, { key: 'fatigue', value: 10 }],
    E('교무실 회식', '금요일 교무실 회식에 초대받았습니다.', 'teacher', [C('간다', [{ key: 'trust', value: 2 }, { key: 'fatigue', value: 10 }]), C('사양한다', [])])) },
  { words: ['헬스', '근육', '운동', '체력', '마라톤', '등산'], trait: T('강철 체력', '야근 정도로는 끄떡없다', [{ key: 'fatigue', value: -15 }, { key: '지도력', value: 1 }]) },
  { words: ['유머', '농담', '개그', '웃기', '재밌'], trait: T('개그 담당', '수업 시간 절반은 웃음', [{ key: 'talk', value: 8 }, { key: 'trust', value: -3 }],
    E('아재 개그', '수업 중에 던진 개그가 이번에는 제대로 터졌습니다.', 'class', [C('한 번 더 한다', [{ key: 'morale', value: 1 }, { key: 'need_grade', value: 5 }])])) },
  { words: ['성실', '꼼꼼', '계획', '정리', '완벽'], trait: T('계획형 인간', '주간 계획표가 색깔별로 칠해져 있다', [{ key: '행정력', value: 1 }, { key: 'budget', value: 1 }]) },
  { words: ['야망', '출세', '승진', '교장', '정치'], trait: T('야심가', '언젠가 교장실에 앉을 사람', [{ key: '정치력', value: 2 }, { key: 'bond', value: -5 }]) },
  { words: ['요리', '음식', '라면', '먹', '빵', '간식'], trait: T('간식 창고', '서랍을 열면 간식이 나온다', [{ key: 'bond', value: 5 }, { key: 'budget', value: -1 }],
    E('서랍 간식 털림', '서랍에 넣어 둔 간식이 사라졌습니다. 범인은 {학생}인 것 같습니다.', 'student', [C('웃고 넘어간다', [{ key: 'need_food', value: -20 }, { key: 'bond', value: 4 }]), C('벌로 청소를 시킨다', [{ key: 'morale', value: -1 }, { key: 'trust', value: 1 }])])) },
  { words: ['음악', '노래', '기타', '피아노', '밴드'], trait: T('음악 하는 쌤', '조회 시간에 가끔 노래를 부른다', [{ key: 'talk', value: 5 }, { key: '동기부여', value: 1 }]) },
  { words: ['졸업생', '한일고 출신', '선배', '모교'], trait: T('한일고 졸업생', '이 학교의 구석구석을 안다', [{ key: 'bond', value: 8 }, { key: 'influence', value: 10 }]) },
  { words: ['명문대', '서울대', '카이스트', '연세', '고려대'], trait: T('명문대 출신', '실력은 확실한데 조금 재수 없다', [{ key: '교과전문성', value: 2 }, { key: '정치력', value: -1 }]) },
  { words: ['학원', '강사', '일타'], trait: T('전직 학원 강사', '시험 대비는 자신 있다', [{ key: '동기부여', value: 1 }, { key: 'trust', value: -5 }]) },
];

// 글에서 키워드를 찾아 특성을 만든다. 아무것도 없으면 평범한 신입.
export function keywordTraits(text) {
  const src = String(text ?? '');
  const hit = KEYWORD_RULES.filter((r) => r.words.some((w) => src.includes(w))).slice(0, 4);
  if (!hit.length) return [{ name: '평범한 신입', desc: '아직 특별한 색깔이 드러나지 않았다', effects: [{ key: 'counsel', value: 2 }] }];
  return hit.map((r) => ({ name: r.trait.name, desc: r.trait.desc, effects: r.trait.effects.map((e) => ({ ...e })) }));
}

export function keywordEvent(traits, rng) {
  const pool = KEYWORD_RULES.filter((r) => r.trait.event && traits.some((t) => t.name === r.trait.name)).map((r) => r.trait.event);
  if (!pool.length) return null;
  return JSON.parse(JSON.stringify(pool[Math.floor(rng.next() * pool.length)]));
}
