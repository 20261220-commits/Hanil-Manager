// 멘토 칸: 선배 교사의 이번 주 추천 할 일, 지난주 결과, 맡긴 일(위임), 이름과 자동 등장 설정
import { getState, save } from './game/state.js';
import { weekTodo, DELEGATES, setMentorName, setDelegate, autoTraining } from './game/mentor.js';
import { mentorSvg, showMentor, mentorLines } from './mentor-npc.js';
import { notify } from './chrome.js';
import { FEATURES, isOpen, openAll } from './game/unlock.js';
import { esc } from './ui.js';

export function renderMentor(app) {
  const s = getState();
  const mt = s.mentor;
  const todo = weekTodo(s);
  const n = todo.filter((t) => t.done).length;
  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>멘토</h1></div>
      <p class="note">선배 교사가 이번 주에 하면 좋은 일을 추천합니다. 해낸 일 1건에 1만원(커피값)을 줍니다.</p></div>
    <div class="mentor-page">
      <section class="panel mentor-hero">
        <div class="mentor-portrait">${mentorSvg(s.world)}</div>
        <div class="mentor-hero-text">
          <b class="mentor-hero-name">${esc(mt.name)} 선생님</b><span class="note">선배 교사</span>
          <p class="note">${mt.last ? `지난주 할 일 ${mt.last.done} / ${mt.last.total}${mt.last.done ? ` · 커피값 +${mt.last.done}만원` : ''}` : '이번 주가 첫 주입니다.'}</p>
          <button type="button" class="btn primary" id="listen">이번 주 이야기 듣기</button>
          <label class="check"><input type="checkbox" id="auto-pop" ${mt.auto !== false ? 'checked' : ''}> 새 주가 되면 자동으로 나와서 알려 주기</label>
        </div>
      </section>
      <section class="panel">
        <h2>이번 주 추천 할 일 <span class="note">${n} / ${todo.length} 완료</span></h2>
        ${todo.length ? `<ol class="todo">${todo.map((t) => `<li class="${t.done ? 'done' : ''}">
          <span class="todo-check" aria-hidden="true">${t.done ? '✓' : ''}</span>
          <span class="todo-text"><b>${esc(t.text)}</b><span class="note">${esc(t.why)}</span></span>
          ${t.done ? '<span class="note">완료</span>' : `<a class="btn small" href="${t.href}">하러 가기</a>`}</li>`).join('')}</ol>`
          : '<p class="note">이번 주는 특별히 챙길 일이 없어요. 하고 싶은 걸 해 보세요.</p>'}
        ${s.delegate.training ? `<p class="note">맡긴 훈련 일정: 지적 ${s.training.intel}% · 신체 ${s.training.body}% · 휴식 ${s.training.rest}% (${esc(autoTraining(s).why)})</p>` : ''}
      </section>
      <section class="panel">
        <h2>선배에게 맡기기</h2>
        <div class="deleg-list">${Object.entries(DELEGATES).map(([k, d]) => `<label class="deleg"><input type="checkbox" data-deleg="${k}" ${s.delegate[k] ? 'checked' : ''}><b>${d.name}</b><span class="note">${d.desc}</span></label>`).join('')}</div>
      </section>
      <section class="panel">
        <div class="row between"><h2>기능 열기 <span class="note">때가 되면 선배가 하나씩 소개하며 엽니다</span></h2>
          ${Object.keys(FEATURES).every((k) => isOpen(s, k)) ? '' : '<button type="button" class="btn small" id="open-all">모든 기능 바로 열기</button>'}</div>
        <ul class="feat-list">${Object.entries(FEATURES).map(([k, f]) => `<li class="${isOpen(s, k) ? 'on' : ''}"><b>${f.name}</b>
          <span class="note">${isOpen(s, k) ? '열림' : `잠김 · ${f.how}`}</span></li>`).join('')}</ul>
      </section>
      <section class="panel">
        <h2>선배 이름</h2>
        <div class="row"><label class="field grow"><span>이름 (1~10자)</span><input id="mentor-name" maxlength="10" autocomplete="off" value="${esc(mt.name)}"></label>
          <button type="button" class="btn" id="mentor-save">이름 바꾸기</button></div>
      </section>
    </div>`;
  app.querySelector('#open-all')?.addEventListener('click', () => notify(openAll()));
  app.querySelector('#listen').addEventListener('click', () => showMentor(mentorLines(s)));
  app.querySelector('#auto-pop').addEventListener('change', (e) => { mt.auto = e.target.checked; save(); });
  app.querySelector('#mentor-save').addEventListener('click', () => notify(setMentorName(app.querySelector('#mentor-name').value)));
  app.querySelectorAll('[data-deleg]').forEach((c) => c.addEventListener('change', () => notify(setDelegate(c.dataset.deleg, c.checked))));
  return [{ label: '멘토' }];
}
