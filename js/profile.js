// 프로필: 이름, 담당 과목, 칭호(얻은 것 중 고르기), 교사 능력치, 기록
import { getState, setTitle } from './game/state.js';
import { subjectByKey } from './content/subjects.js';
import { TITLES } from './content/titles.js';
import { notify } from './chrome.js';
import { esc } from './ui.js';

const RECORDS = [
  ['counselOK', '성공한 상담'], ['overtime', '야근'], ['cover', '감싼 일탈'], ['strict', '벌점·꾸중'], ['gemFound', '찾아낸 원석'],
];

export function renderProfile(app) {
  const s = getState();
  const p = s.profile;
  const sub = subjectByKey(p.subject);
  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.className)} 담임</span><h1>${esc(p.title)} ${esc(p.name)} 선생님</h1></div></div>
    <div class="layout">
      <section class="panel">
        <h2>칭호 <span class="note">얻은 칭호 ${p.titles.length} / ${TITLES.length}</span></h2>
        <div class="title-list">${TITLES.map((t) => {
          const owned = p.titles.includes(t.name);
          return `<label class="title-opt${owned ? '' : ' locked'}">
            <input type="radio" name="title" value="${t.name}" ${p.title === t.name ? 'checked' : ''} ${owned ? '' : 'disabled'}>
            <b>${t.name}</b><span>${owned ? (p.title === t.name ? '사용 중' : '사용 가능') : `잠김 · ${t.how}`}</span></label>`;
        }).join('')}</div>
      </section>
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
  return [{ label: '프로필' }];
}
