// 프로필: 이름, 담당 과목, 칭호(얻은 것 중 고르기), 교사 능력치, 기록
import { getState, setTitle } from './game/state.js';
import { subjectByKey } from './content/subjects.js';
import { TITLES } from './content/titles.js';
import { notify } from './chrome.js';
import { esc, traitCards } from './ui.js';
import { save } from './game/state.js';
import { applyPersona, canEditPersona } from './game/persona.js';
import { bioEditor, bindBioEditor } from './persona-view.js';

let edit = null; // 프로필 글 고치는 중의 임시 상태

const RECORDS = [
  ['counselOK', '성공한 상담'], ['overtime', '야근'], ['cover', '감싼 일탈'], ['strict', '벌점·꾸중'], ['gemFound', '찾아낸 원석'],
];

export function renderProfile(app) {
  const s = getState();
  const p = s.profile;
  const sub = subjectByKey(p.subject);
  const per = s.persona;
  const editable = canEditPersona(s);
  const personaPanel = `
      <section class="panel">
        <div class="row between"><h2>나는 어떤 선생님? <span class="note">${per ? (per.source === 'ai' ? 'AI가 만든 특성' : '키워드 규칙으로 만든 특성') : '특성 없음'}</span></h2>
          ${edit ? '' : editable ? `<button type="button" class="btn small" id="edit-bio">${per ? '고쳐 쓰기' : '쓰기'} (학기마다 1번)</button>` : '<span class="note">이번 학기에는 이미 고쳤습니다</span>'}</div>
        ${edit ? `${bioEditor(edit)}
          <div class="row end"><button type="button" class="btn" id="cancel-bio">취소</button>
            <button type="button" class="btn primary" id="save-bio" ${edit.traits && !edit.busy ? '' : 'disabled'}>이 특성으로 바꾸기</button></div>
          <p class="note">바꾸면 예전 특성의 능력치 변화는 되돌리고 새 특성을 적용합니다. 시작 신임·결속도 효과는 게임 시작 때만 적용됩니다.</p>`
        : per ? `<blockquote class="bio-quote">${esc(per.bio).replace(/\n/g, '<br>')}</blockquote>${traitCards(per.traits)}
          <p class="note">이 성격에 어울리는 이벤트가 몇 주에 한 번씩 받은 편지함에 옵니다.</p>`
          : '<p class="note">자기소개를 쓰면 교사 특성(장점과 약점)과 그 성격에 맞는 이벤트가 생깁니다.</p>'}
      </section>`;
  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.className)} 담임</span><h1>${esc(p.title)} ${esc(p.name)} 선생님</h1></div></div>
    <div class="layout">
      <div class="side-stack">
      ${personaPanel}
      <section class="panel">
        <h2>칭호 <span class="note">얻은 칭호 ${p.titles.length} / ${TITLES.length}</span></h2>
        <div class="title-list">${TITLES.map((t) => {
          const owned = p.titles.includes(t.name);
          return `<label class="title-opt${owned ? '' : ' locked'}">
            <input type="radio" name="title" value="${t.name}" ${p.title === t.name ? 'checked' : ''} ${owned ? '' : 'disabled'}>
            <b>${t.name}</b><span>${owned ? (p.title === t.name ? '사용 중' : '사용 가능') : `잠김 · ${t.how}`}</span></label>`;
        }).join('')}</div>
      </section>
      </div>
      <aside class="side-stack">
        <section class="panel">
          <h2>담당 과목 · ${sub ? sub.name : '없음'}</h2>
          ${sub ? `<dl class="kv"><dt>능력치</dt><dd>${sub.bonus} +2</dd><dt>훈련</dt><dd>${sub.train}</dd><dt>강한 대결</dt><dd>${sub.strong}</dd><dt>특수 효과</dt><dd>${sub.effect}</dd></dl>` : ''}
        </section>
        <section class="panel">
          <h2>교사 능력치</h2>
          <dl class="stats">${Object.entries(s.teacher).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
          <p class="note">피로가 50 이상이면 판정 때 -1, 70 이상이면 -3이 됩니다.</p>
        </section>
        <section class="panel">
          <h2>기록</h2>
          <dl class="kv">${RECORDS.map(([k, l]) => `<dt>${l}</dt><dd>${s.counters[k] ?? 0}</dd>`).join('')}</dl>
        </section>
      </aside>
    </div>`;
  app.querySelectorAll('input[name=title]').forEach((r) => r.addEventListener('change', () => {
    setTitle(r.value);
    notify({ ok: true, msg: `칭호를 "${r.value}"(으)로 바꿨습니다.` });
  }));
  const rerender = () => renderProfile(app);
  app.querySelector('#edit-bio')?.addEventListener('click', () => {
    edit = { bio: per?.bio ?? '', traits: null, source: null, note: '', busy: false };
    rerender();
  });
  app.querySelector('#cancel-bio')?.addEventListener('click', () => { edit = null; rerender(); });
  app.querySelector('#save-bio')?.addEventListener('click', () => {
    applyPersona(s, { bio: edit.bio.trim(), traits: edit.traits, source: edit.source }, { start: false });
    edit = null;
    save();
    notify({ ok: true, msg: '교사 특성을 바꿨습니다.' });
  });
  if (edit) bindBioEditor(app, edit, rerender, { name: p.name, subject: sub?.name ?? '' });
  return [{ label: '프로필' }];
}
