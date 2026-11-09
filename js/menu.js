// 게임 밖 화면: 로딩, 대기 화면, 새로 플레이(프로필 만들기), 세이브 파일, 설정
import { listSlots, lastSlot, loadSlot, deleteSlot, exportSlot, importSlot, newGame, SLOT_COUNT } from './game/state.js';
import { SUBJECTS } from './content/subjects.js';
import { TITLES } from './content/titles.js';
import { getSettings, setSettings } from './settings.js';
import { loadJSON } from './data.js';
import { toast } from './chrome.js';
import { esc } from './ui.js';
import { bioEditor, bindBioEditor } from './persona-view.js';
import { checkServer, serverUrl } from './ai-client.js';
import { AI_SERVER } from './config.js';

const when = (t) => (t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// ---------- 로딩 ----------

export async function renderLoading(app) {
  app.innerHTML = `
    <div class="menu-screen">
      <div class="menu-card loading">
        <div class="logo">한일고 매니저</div>
        <div class="progress" role="progressbar" aria-label="불러오는 중" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="bar"></i></div>
        <p class="note" id="step">학교 지도를 펼치는 중</p>
      </div>
    </div>`;
  const bar = app.querySelector('#bar');
  const step = app.querySelector('#step');
  const tasks = [
    ['학교 지도를 펼치는 중', () => loadJSON('data/campus.json')],
    ['캠퍼스 그림을 불러오는 중', () => new Promise((res) => { const img = new Image(); img.onload = img.onerror = res; img.src = 'assets/campus.webp'; })],
    ['기숙사 배치를 확인하는 중', () => loadJSON('data/floorplans/hyeonjegwan-c.json')],
    ['출석부를 정리하는 중', () => new Promise((res) => setTimeout(res, 250))],
  ];
  for (let i = 0; i < tasks.length; i++) {
    step.textContent = tasks[i][0];
    await tasks[i][1]();
    const pct = Math.round(((i + 1) / tasks.length) * 100);
    bar.style.width = `${pct}%`;
    bar.parentElement.setAttribute('aria-valuenow', String(pct));
  }
  await new Promise((res) => setTimeout(res, 200));
}

// ---------- 대기 화면 ----------

export function renderTitle(app) {
  const last = lastSlot();
  const sum = last ? listSlots().find((x) => x.n === last).summary : null;
  app.innerHTML = `
    <div class="menu-screen title-screen">
      <div class="menu-card">
        <div class="logo">한일고 매니저</div>
        <p class="tagline">신임 교사가 되어 한일고를 장악하고, 전국의 명문고를 정복하라</p>
        <nav class="menu-list" aria-label="시작 메뉴">
          ${sum ? `<button type="button" class="menu-btn primary" id="continue">
            <b>이어서 플레이</b><span>${esc(sum.title)} ${esc(sum.name)} 선생님 · ${esc(sum.week)}</span></button>` : ''}
          <a class="menu-btn${sum ? '' : ' primary'}" href="#new"><b>새로 플레이</b><span>이름과 담당 과목을 정하고 시작합니다</span></a>
          <a class="menu-btn" href="#saves"><b>세이브 파일</b><span>저장 칸 ${SLOT_COUNT}개 · 불러오기, 지우기, 파일로 옮기기</span></a>
          <a class="menu-btn" href="#settings"><b>설정</b><span>테마, 글자 크기, AI 서버</span></a>
        </nav>
      </div>
    </div>`;
  app.querySelector('#continue')?.addEventListener('click', () => {
    if (loadSlot(last)) location.hash = 'campus';
    else toast('세이브를 불러오지 못했습니다.', true);
  });
}

// ---------- 새로 플레이 (프로필 만들기) ----------

const draft = { step: 1, name: '', subject: null, title: TITLES[0].name, slotN: null, confirmOverwrite: false, bio: '', traits: null, source: null, note: '', busy: false };

export function resetDraft() {
  Object.assign(draft, { step: 1, name: '', subject: null, title: TITLES[0].name, slotN: null, confirmOverwrite: false, bio: '', traits: null, source: null, note: '', busy: false });
}

export function renderNewGame(app) {
  const slots = listSlots();
  if (draft.slotN === null) draft.slotN = (slots.find((x) => !x.summary) ?? slots[0]).n;
  const steps = ['이름', '담당 과목', '어떤 선생님?', '칭호와 저장 칸'];

  let body = '';
  if (draft.step === 1) {
    body = `
      <h2>선생님의 이름을 정해 주세요</h2>
      <p class="note">학생들과 교무실에서 부를 이름입니다. 1~10자.</p>
      <input class="name-input-big" id="name" maxlength="10" autocomplete="off" placeholder="예: 김한일" value="${esc(draft.name)}" aria-label="이름">
      <p class="field-error" id="name-error" hidden>이름을 1자 이상 입력해 주세요.</p>`;
  } else if (draft.step === 2) {
    body = `
      <h2>담당 과목을 골라 주세요</h2>
      <p class="note">과목에 따라 시작 능력치(+2), 학생이 잘 크는 스탯, 지휘할 때 강한 대결이 달라집니다.</p>
      <div class="subject-grid" role="radiogroup" aria-label="담당 과목">${SUBJECTS.map((s) => `
        <button type="button" class="subject${draft.subject === s.key ? ' is-on' : ''}" role="radio" aria-checked="${draft.subject === s.key}" data-subject="${s.key}">
          <b>${s.name}</b>
          <span class="kv-line"><i>능력치</i>${s.bonus} +2</span>
          <span class="kv-line"><i>훈련</i>${s.train}</span>
          <span class="kv-line"><i>강한 대결</i>${s.strong}</span>
          <span class="effect">${s.effect}</span>
        </button>`).join('')}</div>
      <p class="field-error" id="subject-error" hidden>과목을 하나 골라 주세요.</p>`;
  } else if (draft.step === 3) {
    body = `
      <h2>나는 어떤 선생님인가요?</h2>
      <p class="note">성격, 버릇, 과거, 좋아하는 것을 자유롭게 써 주세요. 글에 따라 교사 특성(장점과 약점)이 생기고, 플레이 중에 그 성격에 맞는 이벤트가 일어납니다. 비워 두면 특성 없이 시작합니다.</p>
      ${bioEditor(draft)}`;
  } else {
    const sub = SUBJECTS.find((s) => s.key === draft.subject);
    const target = slots.find((x) => x.n === draft.slotN);
    body = `
      <h2>칭호</h2>
      <p class="note">칭호는 이름 앞에 붙습니다. 지금은 하나뿐이고, 플레이하면서 조건을 채우면 새 칭호를 얻어 프로필에서 바꿀 수 있습니다.</p>
      <div class="title-list">${TITLES.map((t, i) => `
        <label class="title-opt${i === 0 ? '' : ' locked'}">
          <input type="radio" name="title" value="${t.name}" ${i === 0 ? 'checked' : 'disabled'}>
          <b>${t.name}</b><span>${i === 0 ? '사용 가능' : `잠김 · ${t.how}`}</span>
        </label>`).join('')}</div>

      <h2>저장 칸</h2>
      <div class="slot-pick" role="radiogroup" aria-label="저장 칸">${slots.map((x) => `
        <button type="button" class="slot${draft.slotN === x.n ? ' is-on' : ''}" role="radio" aria-checked="${draft.slotN === x.n}" data-slot="${x.n}">
          <b>${x.n}번 칸</b>${x.summary ? `<span>${esc(x.summary.name)} 선생님 · ${esc(x.summary.week)}</span><span class="warn-text">덮어씁니다</span>` : '<span>비어 있음</span>'}
        </button>`).join('')}</div>

      <div class="summary-card">
        <span class="note">시작할 선생님</span>
        <b class="who-big">${esc(draft.title)} ${esc(draft.name)} 선생님</b>
        <span>${sub.name} 담당 · ${sub.bonus} +2 · 1학년 4반 담임</span>
        ${draft.traits ? `<span class="note">교사 특성: ${draft.traits.map((t) => esc(t.name)).join(', ')}</span>` : ''}
      </div>
      ${draft.confirmOverwrite && target.summary ? `<p class="field-error">${draft.slotN}번 칸의 "${esc(target.summary.name)} 선생님" 기록이 지워집니다. 한 번 더 누르면 시작합니다.</p>` : ''}`;
  }

  app.innerHTML = `
    <div class="menu-screen">
      <div class="menu-card wide">
        <ol class="steps" aria-label="진행 단계">${steps.map((s, i) => `<li class="${i + 1 === draft.step ? 'now' : i + 1 < draft.step ? 'done' : ''}">${i + 1}. ${s}</li>`).join('')}</ol>
        <form id="wizard" novalidate>${body}
          <div class="wizard-nav">
            ${draft.step === 1 ? '<a class="btn" href="#title">취소</a>' : '<button type="button" class="btn" id="back">이전</button>'}
            <button type="submit" class="btn primary" ${draft.busy ? 'disabled' : ''}>${draft.step === 4 ? '시작하기' : draft.step === 3 && !draft.bio.trim() ? '건너뛰기' : '다음'}</button>
          </div>
        </form>
      </div>
    </div>`;

  const nameInput = app.querySelector('#name');
  if (nameInput) { nameInput.focus(); nameInput.addEventListener('input', () => { draft.name = nameInput.value; }); }
  app.querySelectorAll('[data-subject]').forEach((b) => b.addEventListener('click', () => { draft.subject = b.dataset.subject; renderNewGame(app); }));
  app.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => { draft.slotN = +b.dataset.slot; draft.confirmOverwrite = false; renderNewGame(app); }));
  bindBioEditor(app, draft, () => renderNewGame(app), { name: draft.name, subject: SUBJECTS.find((x) => x.key === draft.subject)?.name ?? '' });
  app.querySelector('#back')?.addEventListener('click', () => { draft.step -= 1; draft.confirmOverwrite = false; renderNewGame(app); });

  app.querySelector('#wizard').addEventListener('submit', (e) => {
    e.preventDefault();
    if (draft.step === 1) {
      draft.name = draft.name.trim();
      if (!draft.name) { app.querySelector('#name-error').hidden = false; return; }
    }
    if (draft.step === 2 && !draft.subject) { app.querySelector('#subject-error').hidden = false; return; }
    if (draft.step === 3) {
      if (draft.busy) return;
      // 글을 썼는데 특성을 아직 안 만들었으면 먼저 만든다
      if (draft.bio.trim() && !draft.traits) { app.querySelector('#make-traits').click(); return; }
      if (!draft.bio.trim()) { draft.traits = null; draft.source = null; }
    }
    if (draft.step < 4) { draft.step += 1; renderNewGame(app); return; }
    const target = slots.find((x) => x.n === draft.slotN);
    if (target.summary && !draft.confirmOverwrite) { draft.confirmOverwrite = true; renderNewGame(app); return; }
    newGame({ name: draft.name, subject: draft.subject, title: draft.title, slotN: draft.slotN,
      persona: draft.traits ? { bio: draft.bio.trim(), traits: draft.traits, source: draft.source } : null });
    resetDraft();
    location.hash = 'campus';
  });
  return [];
}

// ---------- 세이브 파일 ----------

let confirmDelete = null;

export function renderSaves(app) {
  const slots = listSlots();
  app.innerHTML = `
    <div class="menu-screen">
      <div class="menu-card wide">
        <div class="menu-head"><h1>세이브 파일</h1><a class="btn" href="#title">대기 화면으로</a></div>
        <p class="note">게임은 행동할 때마다 지금 칸에 자동 저장됩니다. 저장은 이 브라우저에만 남으니, 다른 기기로 옮기려면 파일로 내보내 주세요.</p>
        <div class="save-list">${slots.map((x) => `
          <article class="save-row">
            <div class="save-info">
              <b>${x.n}번 칸</b>
              ${x.summary
                ? `<span>${esc(x.summary.title)} ${esc(x.summary.name)} 선생님 · ${esc(x.summary.subject)}</span><span class="note">${esc(x.summary.week)} · 마지막 저장 ${when(x.summary.savedAt)}</span>`
                : '<span class="note">비어 있음</span>'}
            </div>
            <div class="save-actions">
              ${x.summary ? `<button type="button" class="btn primary" data-load="${x.n}">불러오기</button>
                <button type="button" class="btn" data-export="${x.n}">파일로 내보내기</button>` : ''}
              <label class="btn file-btn">파일 불러오기<input type="file" accept="application/json,.json" data-import="${x.n}" hidden></label>
              ${x.summary ? (confirmDelete === x.n
                ? `<button type="button" class="btn danger" data-delete="${x.n}">정말 지우기</button><button type="button" class="btn" data-cancel>취소</button>`
                : `<button type="button" class="btn" data-ask-delete="${x.n}">지우기</button>`) : ''}
            </div>
          </article>`).join('')}</div>
      </div>
    </div>`;

  app.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
    if (loadSlot(+b.dataset.load)) location.hash = 'campus'; else toast('불러오지 못했습니다.', true);
  }));
  app.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => {
    const n = +b.dataset.export;
    const blob = new Blob([exportSlot(n)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hanil-manager-slot${n}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`${n}번 칸을 파일로 내보냈습니다. 다운로드가 막힌 환경이면 파일이 생기지 않습니다.`);
  }));
  app.querySelectorAll('[data-import]').forEach((input) => input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const err = importSlot(+input.dataset.import, await file.text());
    toast(err ?? `${input.dataset.import}번 칸으로 불러왔습니다.`, !!err);
    renderSaves(app);
  }));
  app.querySelectorAll('[data-ask-delete]').forEach((b) => b.addEventListener('click', () => { confirmDelete = +b.dataset.askDelete; renderSaves(app); }));
  app.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => { confirmDelete = null; renderSaves(app); }));
  app.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => {
    deleteSlot(+b.dataset.delete); confirmDelete = null; toast('지웠습니다.'); renderSaves(app);
  }));
  return [];
}

// ---------- 설정 ----------

export function renderSettings(app) {
  const s = getSettings();
  const opt = (name, value, label, cur) => `<label class="seg"><input type="radio" name="${name}" value="${value}" ${cur === value ? 'checked' : ''}><span>${label}</span></label>`;
  app.innerHTML = `
    <div class="menu-screen">
      <div class="menu-card wide">
        <div class="menu-head"><h1>설정</h1><a class="btn" href="#title">대기 화면으로</a></div>
        <fieldset class="setting"><legend>테마</legend>
          <div class="segs">${opt('theme', 'system', '기기 설정 따르기', s.theme)}${opt('theme', 'light', '밝게', s.theme)}${opt('theme', 'dark', '어둡게', s.theme)}</div></fieldset>
        <fieldset class="setting"><legend>글자 크기</legend>
          <div class="segs">${opt('textSize', 'normal', '보통', s.textSize)}${opt('textSize', 'large', '크게', s.textSize)}</div></fieldset>
        <fieldset class="setting"><legend>AI 서버 (교사 프로필 특성·이벤트)</legend>
          <p class="note">AI 서버가 연결되면 자기소개 글을 AI가 읽고 특성과 이벤트를 만듭니다. 연결되지 않으면 키워드 규칙으로 동작합니다. API 키는 서버에만 있고 이 브라우저에는 저장되지 않습니다.</p>
          <label class="field"><span>서버 주소</span><input id="ai-server" type="url" inputmode="url" autocomplete="off" placeholder="${esc(AI_SERVER || 'https://hanil-manager-ai.아이디.workers.dev')}" value="${esc(s.aiServer)}"></label>
          ${AI_SERVER ? `<p class="note">비워 두면 기본 서버(${esc(AI_SERVER)})를 씁니다.</p>` : ''}
          <label class="field"><span>친구 코드</span><input id="friend-code" type="password" autocomplete="off" placeholder="서버에 설정했을 때만" value="${esc(s.friendCode)}"></label>
          <div class="row"><button type="button" class="btn" id="ai-check">연결 확인</button><span class="note" id="ai-status">${serverUrl() ? `지금 쓰는 서버: ${esc(serverUrl())}` : '연결된 서버 없음 (키워드 규칙)'}</span></div>
        </fieldset>
        <p class="note">설정은 이 브라우저에 저장됩니다.</p>
      </div>
    </div>`;
  app.querySelectorAll('input[type=radio]').forEach((r) => r.addEventListener('change', () => { setSettings({ [r.name]: r.value }); toast('설정을 바꿨습니다.'); }));
  const status = app.querySelector('#ai-status');
  app.querySelector('#ai-server').addEventListener('change', (e) => { setSettings({ aiServer: e.target.value.trim() }); status.textContent = serverUrl() ? `지금 쓰는 서버: ${serverUrl()}` : '연결된 서버 없음 (키워드 규칙)'; });
  app.querySelector('#friend-code').addEventListener('change', (e) => { setSettings({ friendCode: e.target.value }); });
  app.querySelector('#ai-check').addEventListener('click', async () => {
    setSettings({ aiServer: app.querySelector('#ai-server').value.trim(), friendCode: app.querySelector('#friend-code').value });
    if (!serverUrl()) { status.textContent = '서버 주소를 먼저 넣어 주세요.'; return; }
    status.textContent = '확인하는 중…';
    try {
      const r = await checkServer();
      status.textContent = r.ok ? `연결됐습니다.${r.needsCode ? ' 이 서버는 친구 코드가 필요합니다.' : ''}` : '서버에 연결됐지만 API 키가 설정되지 않았습니다.';
    } catch (err) { status.textContent = `연결하지 못했습니다: ${err.message}`; }
  });
  return [];
}

