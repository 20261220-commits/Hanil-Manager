// 선배 교사 (입문 도우미): 매주 "이번 주 할 일"을 알려 주고, 맡긴 일(위임)을 대신 처리한다.
// 이름은 플레이어가 정한다. 할 일을 해내면 작은 보상(1건에 1만원)이 있다.
import { getState, save, addMessage } from './state.js';
import { needLevel } from './students.js';
import { nextExamTurn } from './exam.js';
import { yearTurn } from './calendar.js';
import { approve, MEETING } from './meeting.js';
import { isAlly } from './intrigue.js';
import { placeById } from './school.js';
import { challengeBlock, target } from './duel.js';
import { MORALE } from '../content/stats.js';
import { classLabel } from '../content/factions.js';
import { electionOpen } from './election.js';

export const DEFAULT_MENTOR = '오세진';
export const DELEGATES = {
  training: { name: '훈련 일정', desc: '매주 시험·컨디션·피로를 보고 지적·신체·휴식 비율을 정합니다.' },
  council: { name: '교무회의 표결', desc: '다른 계파가 올린 안건에 대신 표를 던집니다. 우리 자리를 노리는 안건은 반대합니다.' },
  meeting: { name: '반 편성 회의', desc: '연말 반 편성을 기본 배정으로 바로 확정합니다.' },
  duel: { name: '대결 명단·전술', desc: '종목만 고르면 명단·전술·경기 전 훈화를 정하고, 경기도 끝까지 맡길 수 있습니다.' },
};

export function ensureMentor(s) {
  s.mentor ??= { name: DEFAULT_MENTOR, todo: null, last: null, intro: false };
  s.delegate ??= { training: false, council: false, meeting: false, duel: false };
  return s.mentor;
}

export function setMentorName(name) {
  const s = getState();
  const n = String(name ?? '').trim().slice(0, 10);
  if (!n) return { ok: false, msg: '이름을 1자 이상 적어 주세요.' };
  ensureMentor(s).name = n;
  save();
  return { ok: true, msg: `선배 교사 이름을 "${n}"(으)로 정했습니다.` };
}

export function setDelegate(key, on) {
  const s = getState();
  ensureMentor(s);
  s.delegate[key] = !!on;
  if (key === 'training' && on) s.training = autoTraining(s);
  save();
  return { ok: true, msg: `${DELEGATES[key].name}: ${on ? `${s.mentor.name} 선생님에게 맡겼습니다` : '직접 합니다'}.` };
}

// ---------- 위임 ----------

const avg = (xs) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);

export function autoTraining(s) {
  const examIn = nextExamTurn(s.turn) - s.turn;
  const cond = avg(s.students.map((st) => st.condition));
  const need = avg(s.students.map(needLevel));
  if (examIn <= 2) return { intel: 65, body: 15, rest: 20, why: '시험이 코앞이라 공부 위주로' };
  if (cond < 70 || need >= 60 || s.fatigue >= 70) return { intel: 35, body: 25, rest: 40, why: '아이들이 지쳐 있어서 쉬는 시간을 늘려' };
  return { intel: 45, body: 35, rest: 20, why: '고르게' };
}

// 다른 계파 안건에 대신 표 던지기
export function mentorVote(s, m) {
  const a = m.council;
  const ours = (a.kind === 'room' || a.kind === 'noconf') && placeById(s, a.target)?.owner === 'player';
  if (ours) return 'no';
  if (isAlly(s, a.proposer) || (s.school.rel?.[a.proposer] ?? 0) >= 20) return 'yes';
  return 'abstain';
}

// 대결 전 훈화: ◎가 가장 많고 ✕가 적은 것
export function mentorTalk(lineup, persOf, talks) {
  let best = null, bestV = 0;
  talks.forEach((_, i) => {
    const v = lineup.reduce((a, l) => { const t = persOf(l.id)?.talk[i]; return a + (t === '◎' ? 1 : t === '✕' ? -1.5 : 0); }, 0);
    if (v > bestV) { bestV = v; best = i; }
  });
  return best;
}

// ---------- 이번 주 할 일 ----------

const lowMorale = (st) => MORALE.indexOf(st.morale) <= 1;

function candidates(s) {
  const out = [];
  // 1. 사기 낮은 학생 상담
  const sad = [...s.students].filter((st) => lowMorale(st) || needLevel(st) >= 70)
    .sort((a, b) => MORALE.indexOf(a.morale) - MORALE.indexOf(b.morale) || needLevel(b) - needLevel(a))[0];
  if (sad) out.push({ kind: 'counsel', ref: sad.id, href: `#s-${sad.id}`, text: `${sad.name} 상담하기`, why: lowMorale(sad) ? `사기가 ${sad.morale}입니다.` : `고민이 쌓였습니다 (욕구 ${needLevel(sad)}).` });
  // 2. 점령이 가까운 반에 대결
  const near = s.school.classes.filter((c) => c.owner !== 'player' && c.support.player >= 38)
    .map((c) => ({ c, t: target(s, c.id) })).filter((x) => x.t && !challengeBlock(s, x.t))
    .sort((a, b) => b.c.support.player - a.c.support.player)[0];
  if (near) {
    const r = near.c.record;
    out.push({ kind: 'duel', ref: near.c.id, base: r.w + r.l + r.d, href: `#duel-${near.c.id}`, text: `${classLabel(near.c.id)}에 대결 걸기`,
      why: `우리 지지도 ${Math.round(near.c.support.player)}%라 이기면 점령할 수 있습니다.` });
  }
  // 3. 시험 대비
  const examIn = nextExamTurn(s.turn) - s.turn;
  if (examIn <= 2 && !s.delegate.training && s.training.intel < 60) out.push({ kind: 'examTrain', href: '#plan', text: '훈련 일정에서 지적 60% 이상', why: `시험이 ${examIn === 0 ? '이번 주' : `${examIn}주 뒤`}입니다.` });
  // 4. 컨디션
  const cond = avg(s.students.map((st) => st.condition));
  if (cond < 70 && !s.delegate.training && s.training.rest < 25) out.push({ kind: 'rest', href: '#plan', text: '훈련 일정에서 휴식 25% 이상', why: `반 평균 컨디션이 ${Math.round(cond)}%입니다.` });
  // 5. 피로
  if (s.fatigue >= 60) out.push({ kind: 'saveAp', href: '#plan', text: 'AP를 2 이상 남기고 주 마치기', why: `피로가 ${s.fatigue}입니다. 남긴 AP는 피로 회복이 됩니다.` });
  // 6. 반장 선거·반 편성 같은 시기 일
  if (electionOpen(s)) out.push({ kind: 'visit', ref: 'election', href: '#election', text: '반장 선거 살펴보기', why: '곧 우리 반 반장을 뽑습니다. 후보와 선거 운동을 미리 살펴보세요.' });
  // 7. 교무회의 안건 (반 2개 이상일 때)
  if (!s.school.agenda && s.school.classes.filter((c) => c.owner === 'player').length >= 2 && s.turn >= 5) out.push({ kind: 'agenda', href: '#office', text: '교무회의에 우리 안건 올리기', why: '이번 달 회의에서 특별실이나 규칙을 가져올 수 있습니다.' });
  // 8. 기본: 담임반 아이들 훈련 집중
  if (s.fatigue < 60) out.push({ kind: 'spendAp', href: '#class', text: 'AP를 모두 쓰기', why: '상담·집중 훈련·관찰로 담임반을 키우세요.' });
  return out.slice(0, 3);
}

// 그 주 할 일을 해냈는지 (주말 정산 직전에 판단)
function isDone(s, it) {
  switch (it.kind) {
    case 'counsel': return s.students.find((st) => st.id === it.ref)?.lastCounsel === s.turn;
    case 'duel': { const c = s.school.classes.find((x) => x.id === it.ref); const r = c?.record; return !!r && (r.w + r.l + r.d > it.base || c.owner === 'player'); }
    case 'examTrain': return s.training.intel >= 60;
    case 'rest': return s.training.rest >= 25;
    case 'saveAp': return s.ap >= 2;
    case 'agenda': return !!s.school.agenda;
    case 'spendAp': return s.ap <= 0;
    case 'visit': return !!s.mentor.visited?.[it.ref];
    default: return false;
  }
}

export function weekTodo(s) {
  ensureMentor(s);
  if (!s.mentor.todo || s.mentor.todo.turn !== s.turn) s.mentor.todo = { turn: s.turn, items: candidates(s) };
  return s.mentor.todo.items.map((it) => ({ ...it, done: isDone(s, it) }));
}
export function markVisit(s, key) { ensureMentor(s); (s.mentor.visited ??= {})[key] = s.turn; }

// 주말 정산 시작: 할 일 결산과 보상
export function mentorWeekEnd(s) {
  ensureMentor(s);
  const items = s.mentor.todo?.turn === s.turn ? s.mentor.todo.items : [];
  const done = items.filter((it) => isDone(s, it)).length;
  if (done) s.budget += done;
  s.mentor.last = items.length ? { done, total: items.length } : null;
}

// 새 주 시작: 맡긴 일 처리, 할 일 새로 만들기
export function mentorWeekStart(s, resolveDecision) {
  ensureMentor(s);
  const name = s.mentor.name;
  if (s.delegate.training) s.training = autoTraining(s);
  if (s.delegate.council) {
    for (const m of s.inbox.filter((x) => x.council && x.choices && !x.resolved)) {
      const v = mentorVote(s, m);
      resolveDecision(m.id, v);
      m.result = `${name} 선생님이 대신 ${{ yes: '찬성', no: '반대', abstain: '기권' }[v]} · ${m.result.split(' · ').slice(1).join(' · ')}`;
    }
  }
  if (s.delegate.meeting && yearTurn(s.turn) === MEETING && s.meeting && s.meeting.phase !== 'done') {
    approve(s);
    addMessage({ kind: 'report', title: `${name} 선생님이 반 편성을 마쳤습니다`, body: '맡겨 주신 대로 기본 배정으로 반 편성을 확정했습니다.' });
  }
  s.mentor.todo = { turn: s.turn, items: candidates(s) };
}

// 첫 주 인사 (새 게임과 예전 세이브)
export function mentorIntro(s) {
  ensureMentor(s);
  if (s.mentor.intro) return;
  s.mentor.intro = true;
  addMessage({
    kind: 'info', tag: '선배 교사',
    title: `${s.mentor.name} 선생님: "모르는 건 저한테 물어보세요"`,
    body: [
      `옆자리 선배 교사 ${s.mentor.name}입니다. 매주 새 주가 되면 화면 오른쪽 아래에 나와서 "이번 주 할 일"을 알려 드릴게요. 왼쪽 "멘토" 칸에서도 볼 수 있어요. 해내면 제가 커피값(1건에 1만원)을 드립니다.`,
      '처음엔 담임반 아이들 상담과 훈련부터 하시고, 지지도가 오른 옆 반에 대결을 걸어 보세요.',
      '훈련 일정, 교무회의 표결, 반 편성, 대결 명단·전술이 번거로우면 왼쪽 "멘토" 칸에서 저한테 맡기셔도 됩니다.',
    ].join('\n'),
  });
}

