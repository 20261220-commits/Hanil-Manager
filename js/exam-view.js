// 시험 화면 (룰북 9.9): 대비 전략 고르기 → 시험 3일 (작전 타임) → 결과
import { getState } from './game/state.js';
import { weekLabel } from './game/calendar.js';
import {
  ensureExam, examName, inPrepWindow, isExamWeek, chooseStrategy, examDay, setNight, coachStudent,
  STRATEGIES, NIGHT, EXAM_DAYS, EXAM_SUBJECTS, PREP_WEEKS, hardSubjectOf, hasResearch,
} from './game/exam.js';
import { HOMEROOM_ID, classLabel } from './content/factions.js';
import { notify } from './chrome.js';
import { esc } from './ui.js';
import { factionChip } from './school-view.js';

export function renderExam(app) {
  const s = getState();
  const e = ensureExam(s);
  const name = examName(e.turn);
  const weeks = e.turn - s.turn;
  const prep = inPrepWindow(s, e);
  const week = isExamWeek(s, e);
  const R = e.results;
  const hard = hardSubjectOf(s, e.turn);

  const strategyCards = Object.entries(STRATEGIES).map(([k, v]) => `
    <button type="button" class="sport ${e.strategy === k ? 'is-on' : ''}" data-strategy="${k}" ${prep ? '' : 'disabled'}>
      <b>${v.name}</b><span class="note">${v.desc}</span></button>`).join('');

  const subjectTable = `<div class="table-wrap"><table class="roster plain"><thead><tr><th>과목</th><th>시험일</th><th>쓰는 스탯</th><th>우리 반 과목 능력 (스탯 평균)</th></tr></thead><tbody>
    ${Object.entries(EXAM_SUBJECTS).map(([subj, w]) => {
      const day = EXAM_DAYS.findIndex((d) => d.includes(subj)) + 1;
      const avg = s.students.reduce((a, st) => a + Object.entries(w).reduce((x, [k, v]) => x + st.stats[k] * v, 0) / Object.values(w).reduce((x, v) => x + v, 0), 0) / s.students.length;
      return `<tr><td><b>${subj}</b>${hasResearch(s) && subj === hard ? ' <span class="pill warn">이번에 어려움</span>' : ''}</td><td>${day}일차</td><td class="note">${Object.entries(w).map(([k, v]) => `${k} ${v}`).join(', ')}</td><td class="num">${avg.toFixed(1)}</td></tr>`;
    }).join('')}</tbody></table></div>`;

  let main = '';
  if (R && R.ranking) {
    // 결과
    main = `<section class="panel result ${R.homeRank <= 3 ? 'good' : R.homeRank >= 6 ? 'bad' : ''}">
      <h2 class="result-head">1학년 ${R.homeRank}등</h2>
      <p>담임반 지지도 <b>${R.homeDelta > 0 ? '+' : ''}${R.homeDelta.toFixed(1)}%p</b> · 대비 전략 ${STRATEGIES[e.strategy].name} · 어려운 과목 ${hard}</p>
      <div class="table-wrap"><table class="roster plain"><thead><tr><th>순위</th><th>반</th><th>주인</th><th>전략</th><th>1일차</th><th>2일차</th><th>3일차</th><th>평균</th></tr></thead><tbody>
        ${R.ranking.map((r) => `<tr class="${r.id === HOMEROOM_ID ? 'ours' : ''}"><td class="num">${r.rank}</td><td><b>${classLabel(r.id)}</b></td>
          <td>${factionChip(s.school.classes.find((c) => c.id === r.id).owner)}</td><td class="note">${STRATEGIES[r.strategy].name}</td>
          ${r.days.map((d) => `<td class="num">${d}</td>`).join('')}<td class="num"><b>${r.total}</b></td></tr>`).join('')}</tbody></table></div>
      <h3>1학년 1~3등</h3>
      <ol class="news">${R.top.map((t) => `<li><b>${esc(t.name)}</b> (${classLabel(t.classId)}) ${t.total}점${t.classId === HOMEROOM_ID ? ' <span class="pill good">우리 반 · 명성 +150</span>' : ''}</li>`).join('')}</ol>
    </section>`;
  } else if (week) {
    // 시험 진행
    const ranking = R ? Object.entries(R.classes).sort((a, b) => b[1].total - a[1].total) : [];
    const ourRank = ranking.findIndex(([id]) => id === HOMEROOM_ID) + 1;
    const ours = R ? Object.values(R.students).filter((x) => x.classId === HOMEROOM_ID).sort((a, b) => b.total - a.total) : [];
    main = `<section class="panel agenda">
      <div class="row between"><h2>${name} · ${e.day < EXAM_DAYS.length ? `${e.day + 1}일차: ${EXAM_DAYS[e.day].join(', ')}` : '끝'}</h2>
        <span class="note">대비 전략: ${STRATEGIES[e.strategy].name}${hasResearch(s) ? ` · 연구부장 정보: ${hard}이(가) 어렵게 나옴 (우리 반 +4점)` : ''}</span></div>
      ${e.day > 0 ? `<p>지금 1학년 ${ourRank}등 · 우리 반 평균 ${R.classes[HOMEROOM_ID].total}점</p>
        <h3>작전 타임 (오늘 밤)</h3>
        <div class="segs">${Object.entries(NIGHT).map(([k, v]) => `<label class="seg"><input type="radio" name="night" value="${k}" ${e.night === k ? 'checked' : ''}><span>${v.name} · ${v.desc}</span></label>`).join('')}</div>
        <div class="row"><select id="coach" aria-label="개별 지시할 학생" ${e.coach ? 'disabled' : ''}>${[...s.students].sort((a, b) => a.no - b.no).map((st) => `<option value="${st.id}">${esc(st.name)} (컨디션 ${st.condition}%)</option>`).join('')}</select>
          <button type="button" class="btn" id="coach-btn" ${e.coach ? 'disabled' : ''}>개별 지시 (시험마다 1번)</button></div>` : '<p class="note">시험 첫날입니다. 지난 4주 동안 준비한 대로 봅니다.</p>'}
      <div class="row end"><button type="button" class="btn primary big" id="day">${e.day + 1}일차 시험 보기 ▶</button></div>
    </section>
    ${R ? `<div class="office-cols">
      <section class="panel"><h2>1학년 반 순위 (지금까지)</h2><ol class="news">${ranking.map(([id, v]) => `<li class="${id === HOMEROOM_ID ? 'ours' : ''}">${classLabel(id)} ${v.total}점</li>`).join('')}</ol></section>
      <section class="panel"><h2>우리 반 상위 5명</h2><ol class="news">${ours.slice(0, 5).map((x) => `<li>${esc(x.name)} ${x.total}점</li>`).join('')}</ol></section>
    </div>` : ''}`;
  } else {
    main = `<section class="panel">
      <h2>대비 전략 <span class="note">${prep ? `지금 고를 수 있습니다 (시험 ${weeks}주 전)` : `시험 ${PREP_WEEKS}주 전(${weekLabel(e.turn - PREP_WEEKS).split(' (')[0]})부터 고를 수 있습니다`}</span></h2>
      <div class="sport-grid">${strategyCards}</div>
      ${hasResearch(s) ? `<p class="note">연구부장 정보: 이번 시험은 <b>${hard}</b>이(가) 어렵게 나옵니다 (모든 반 -8점, 우리 반은 대비해서 +4점).</p>` : '<p class="note">출제 경향은 연구부장 자리를 가지면 미리 알 수 있습니다.</p>'}
    </section>`;
  }

  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>시험</h1></div>
      <p class="note">${name}: ${weekLabel(e.turn)}${weeks > 0 ? ` · ${weeks}주 남음` : week ? ' · 이번 주' : ''}. 반 전체가 3일 동안 시험을 봅니다. 결과는 1학년 반 순위에 따라 지지도에 반영됩니다.</p></div>
    ${main}
    <section class="panel"><h2>과목 <span class="note">과목 점수 = 과목 능력(스탯 가중 평균 × 컨디션·사기·교사 보정) + 무작위 편차 ±8 + 대비 전략 보너스</span></h2>${subjectTable}</section>`;

  app.querySelectorAll('[data-strategy]').forEach((b) => b.addEventListener('click', () => notify(chooseStrategy(b.dataset.strategy))));
  app.querySelector('#day')?.addEventListener('click', () => notify(examDay()));
  app.querySelectorAll('input[name=night]').forEach((r) => r.addEventListener('change', () => notify(setNight(r.value))));
  app.querySelector('#coach-btn')?.addEventListener('click', () => notify(coachStudent(app.querySelector('#coach').value)));
  return [{ label: '시험' }];
}

