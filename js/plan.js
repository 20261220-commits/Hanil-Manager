// 행동·훈련: 이번 주 훈련 배분과 반 전체·교사 행동, 상담이 필요한 학생
import { getState } from './game/state.js';
import { ACTIONS, setTraining, doTalk, doSnack, doBonding, doReport, doSeminar, doOvertime, doCounsel, needName } from './game/turn.js';
import { needLevel, topNeed } from './game/students.js';
import { PERSONALITIES, TALKS } from './content/personality.js';
import { notify } from './chrome.js';
import { esc, moralePill, needBar } from './ui.js';

const PERS = Object.fromEntries(PERSONALITIES.map((p) => [p.name, p]));

export function renderPlan(app) {
  const s = getState();
  const t = s.training;
  const talkStats = TALKS.map((_, i) => ({
    good: s.students.filter((st) => PERS[st.personality].talk[i] === '◎').length,
    bad: s.students.filter((st) => PERS[st.personality].talk[i] === '✕' || (i === 0 && st.trait === '유리멘탈')).length,
  }));
  const needy = [...s.students].sort((a, b) => needLevel(b) - needLevel(a)).slice(0, 6);
  const used = (k) => s.usedThisWeek[k];
  const card = (key, body, extra = '') => {
    const a = ACTIONS[key];
    return `<article class="act"><header><h2>${a.label}</h2><span class="cost">${a.ap ? `${a.ap} AP` : 'AP 없음'}${a.cost ? ` · ${a.cost}만원` : ''}</span></header>
      <p class="note">${a.desc}</p>${body}${extra}</article>`;
  };

  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>행동·훈련</h1></div>
      <p class="note">AP를 다 쓰면 위쪽의 <b>다음 주로</b>를 눌러 주말 정산을 합니다. 남긴 AP는 피로 회복으로 바뀝니다.</p></div>

    <section class="panel">
      <h2>훈련 일정 <span class="note">AP 없음 · 언제든 바꿀 수 있음</span></h2>
      <div class="train">
        <label for="tr-intel">지적 <output id="o-intel">${t.intel}%</output></label>
        <input type="range" id="tr-intel" min="0" max="100" step="5" value="${t.intel}">
        <label for="tr-body">신체 <output id="o-body">${t.body}%</output></label>
        <input type="range" id="tr-body" min="0" max="100" step="5" value="${t.body}">
        <span class="lbl">휴식</span><b id="o-rest">${t.rest}%</b>
      </div>
      <div class="trainbar" aria-hidden="true"><i class="ti" style="width:${t.intel}%"></i><i class="tb" style="width:${t.body}%"></i><i class="tr" style="width:${t.rest}%"></i></div>
      <p class="note">지적은 시험·토론·행사 스탯을, 신체는 반 대항전 스탯을 키웁니다. 정신 스탯은 두 훈련에서 조금씩 자랍니다. 휴식은 성장 대신 욕구를 낮추고 컨디션을 회복합니다. 신체 60% 이상이면 컨디션이 떨어집니다.</p>
    </section>

    <h2 class="group-title">반 전체</h2>
    <div class="acts">
      ${card('talk', `<div class="talk-btns">${TALKS.map((name, i) => `<button type="button" class="btn" data-talk="${i}" ${used('talk') || s.ap < 2 ? 'disabled' : ''}>
        <b>${name}</b><span>◎ ${talkStats[i].good}명 · ✕ ${talkStats[i].bad}명</span></button>`).join('')}</div>`)}
      ${card('snack', `<button type="button" class="btn" data-act="snack" ${used('snack') || s.budget < 5 ? 'disabled' : ''}>야식 돌리기</button>`)}
      ${card('bonding', `<button type="button" class="btn" data-act="bonding" ${used('bonding') || s.ap < 2 || s.budget < 10 ? 'disabled' : ''}>행사 열기</button>`)}
    </div>

    <h2 class="group-title">상담이 필요한 학생 <span class="note">욕구가 높은 순 · 학생별 행동은 학생 화면에서도 할 수 있습니다</span></h2>
    <div class="table-wrap"><table class="roster"><tbody>${needy.map((st) => `
      <tr><td><a href="#s-${st.id}">${esc(st.name)}</a></td><td>${moralePill(st.morale)}</td>
        <td><span class="needcell">${needBar(needLevel(st))}<span class="note">${needName(topNeed(st))} ${needLevel(st)}</span></span></td>
        <td><button type="button" class="btn small" data-counsel="${st.id}" ${s.ap < 1 ? 'disabled' : ''}>상담 (1 AP)</button></td></tr>`).join('')}</tbody></table></div>

    <h2 class="group-title">교사</h2>
    <div class="acts">
      ${card('report', `<button type="button" class="btn" data-act="report" ${used('report') || s.ap < 1 ? 'disabled' : ''}>보고하기</button>`)}
      ${card('seminar', `<div class="row"><select id="seminar-stat" aria-label="연수 받을 능력치">${Object.entries(s.teacher).map(([k, v]) => `<option value="${k}">${k} ${v}</option>`).join('')}</select>
        <button type="button" class="btn" data-act="seminar" ${s.ap < 3 ? 'disabled' : ''}>연수 받기</button></div>`)}
      ${card('overtime', `<button type="button" class="btn" data-act="overtime" ${s.overtime >= 2 ? 'disabled' : ''}>야근하기 (${2 - s.overtime}번 남음)</button>`)}
    </div>`;

  // 훈련 배분: 지적 + 신체가 100을 넘지 않게 하고 나머지는 휴식
  const intel = app.querySelector('#tr-intel'), body = app.querySelector('#tr-body');
  const sync = (changed) => {
    let i = +intel.value, b = +body.value;
    if (i + b > 100) { if (changed === 'intel') b = 100 - i; else i = 100 - b; }
    intel.value = i; body.value = b;
    const r = 100 - i - b;
    app.querySelector('#o-intel').textContent = `${i}%`;
    app.querySelector('#o-body').textContent = `${b}%`;
    app.querySelector('#o-rest').textContent = `${r}%`;
    const bars = app.querySelectorAll('.trainbar i');
    bars[0].style.width = `${i}%`; bars[1].style.width = `${b}%`; bars[2].style.width = `${r}%`;
    return { intel: i, body: b, rest: r };
  };
  intel.addEventListener('input', () => sync('intel'));
  body.addEventListener('input', () => sync('body'));
  intel.addEventListener('change', () => setTraining(sync('intel')));
  body.addEventListener('change', () => setTraining(sync('body')));

  app.querySelectorAll('[data-talk]').forEach((b) => b.addEventListener('click', () => notify(doTalk(+b.dataset.talk))));
  app.querySelectorAll('[data-counsel]').forEach((b) => b.addEventListener('click', () => notify(doCounsel(b.dataset.counsel))));
  const run = { snack: doSnack, bonding: doBonding, report: doReport, overtime: doOvertime,
    seminar: () => doSeminar(app.querySelector('#seminar-stat').value) };
  app.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => notify(run[b.dataset.act]())));

  return [{ label: '행동·훈련' }];
}
