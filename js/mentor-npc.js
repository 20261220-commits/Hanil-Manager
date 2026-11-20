// 멘토(선배 교사) NPC: 화면 오른쪽 아래에 캐릭터가 나타나 말풍선으로 이번 주 할 일을 알려 준다.
// 뒤 화면은 살짝 어두워지고, 클릭(또는 Enter)으로 다음 말풍선, "끝내기"로 닫는다. 글자는 한 자씩 빠르게 찍힌다.
import { getState, save } from './game/state.js';
import { weekTodo, autoTraining } from './game/mentor.js';
import { translate } from './world.js';
import { FEATURES, newlyOpened } from './game/unlock.js';
import { esc } from './ui.js';

const TYPE_MS = 22; // 글자 하나 찍는 간격

// ---------- 캐릭터 그림 (세계관마다 옷차림이 다르다) ----------

export function mentorSvg(world = 'real', { talking = false } = {}) {
  const skin = '#f2c9a5', skinDark = '#e2b28c';
  const look = {
    real: { cloth: '#2f4a6d', trim: '#ffffff', hair: '#3a2a20' },
    wuxia: { cloth: '#e8e1d2', trim: '#8a3b24', hair: '#16120f' },
    magic: { cloth: '#3b2f78', trim: '#e2b94a', hair: '#5a3a26' },
    cyber: { cloth: '#1d2430', trim: '#3cf0ff', hair: '#2a2f3a' },
  }[world] ?? { cloth: '#2f4a6d', trim: '#ffffff', hair: '#3a2a20' };
  const extraBack = world === 'wuxia' ? `<circle cx="100" cy="46" r="15" fill="${look.hair}"/><line x1="78" y1="40" x2="124" y2="52" stroke="#c9a46a" stroke-width="3" stroke-linecap="round"/>` : '';
  const body = {
    real: `<path d="M18 240 C24 186 60 170 100 170 C140 170 176 186 182 240 Z" fill="${look.cloth}"/>
      <path d="M82 170 L100 204 L118 170 Z" fill="#ffffff"/><path d="M96 176 L100 214 L104 176 Z" fill="#8a3b3b"/>
      <path d="M86 172 L96 226 M114 172 L104 226" stroke="#d9a520" stroke-width="2" fill="none"/><rect x="88" y="222" width="24" height="16" rx="2" fill="#ffffff" stroke="#c9ced6"/>`,
    wuxia: `<path d="M18 240 C24 186 60 170 100 170 C140 170 176 186 182 240 Z" fill="${look.cloth}"/>
      <path d="M72 174 L122 240" stroke="${look.trim}" stroke-width="9"/><path d="M128 174 L96 214" stroke="${look.trim}" stroke-width="9"/>
      <rect x="40" y="226" width="120" height="10" fill="${look.trim}" opacity=".9"/>`,
    magic: `<path d="M14 240 C22 182 60 168 100 168 C140 168 178 182 186 240 Z" fill="${look.cloth}"/>
      <path d="M80 170 L100 198 L120 170" fill="none" stroke="${look.trim}" stroke-width="3"/><circle cx="100" cy="200" r="6" fill="${look.trim}"/>
      <path d="M100 194 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1 z" fill="#fff6d0"/>`,
    cyber: `<path d="M18 240 C24 186 60 170 100 170 C140 170 176 186 182 240 Z" fill="${look.cloth}"/>
      <path d="M62 184 L82 240 M138 184 L118 240" stroke="${look.trim}" stroke-width="2.5"/><path d="M84 172 L100 196 L116 172" fill="none" stroke="${look.trim}" stroke-width="2"/>
      <circle cx="140" cy="206" r="4" fill="${look.trim}"/>`,
  }[world] ?? '';
  const hair = {
    real: `<path d="M56 104 C50 60 80 46 102 48 C132 48 152 66 146 104 C140 84 124 74 100 76 C82 76 64 86 56 104 Z" fill="${look.hair}"/>`,
    wuxia: `<path d="M56 106 C50 58 80 46 100 48 C122 48 152 60 144 106 C140 80 122 70 100 70 C80 70 62 80 56 106 Z" fill="${look.hair}"/>`,
    magic: `<path d="M56 110 C52 76 74 64 100 64 C128 64 150 76 144 110 C138 92 122 84 100 84 C80 84 62 92 56 110 Z" fill="${look.hair}"/>`,
    cyber: `<path d="M58 96 C56 62 82 50 104 52 C130 54 148 68 144 92 L144 80 C132 70 118 66 100 68 C82 70 66 78 58 96 Z" fill="${look.hair}"/><rect x="56" y="86" width="6" height="22" fill="${look.hair}" opacity=".4"/>`,
  }[world] ?? '';
  const hat = world === 'magic' ? `<path d="M64 70 L108 4 L138 70 Z" fill="${look.cloth}"/><rect x="66" y="58" width="70" height="9" fill="${look.trim}"/>
    <ellipse cx="100" cy="70" rx="62" ry="11" fill="${look.cloth}"/><circle cx="116" cy="34" r="3" fill="#fff6d0"/>` : '';
  const eyes = world === 'cyber'
    ? `<rect x="58" y="98" width="84" height="18" rx="9" fill="#0d2a33"/><rect x="60" y="100" width="80" height="14" rx="7" fill="${look.trim}" opacity=".75"/>
       <g class="npc-eyes"><rect x="78" y="104" width="12" height="5" rx="2" fill="#e8ffff"/><rect x="110" y="104" width="12" height="5" rx="2" fill="#e8ffff"/></g>`
    : `<g class="npc-eyes"><ellipse cx="84" cy="108" rx="4" ry="5" fill="#1c2330"/><ellipse cx="116" cy="108" rx="4" ry="5" fill="#1c2330"/></g>
       <path d="M76 96 Q84 92 92 96 M108 96 Q116 92 124 96" stroke="${look.hair}" stroke-width="3" fill="none" stroke-linecap="round"/>
       ${world === 'real' || world === 'magic' ? '<g fill="none" stroke="#1c2330" stroke-width="2"><circle cx="84" cy="108" r="12"/><circle cx="116" cy="108" r="12"/><path d="M96 107 L104 107"/></g>' : ''}`;
  return `<svg class="npc-svg${talking ? ' talking' : ''}" viewBox="0 0 200 240" role="img" aria-label="선배 교사">
    ${extraBack}
    ${body}
    <rect x="88" y="140" width="24" height="34" rx="8" fill="${skinDark}"/>
    <ellipse cx="58" cy="110" rx="7" ry="10" fill="${skinDark}"/><ellipse cx="142" cy="110" rx="7" ry="10" fill="${skinDark}"/>
    <ellipse cx="100" cy="106" rx="42" ry="48" fill="${skin}"/>
    ${hair}${hat}${eyes}
    <circle cx="76" cy="124" r="6" fill="#e88a7a" opacity=".3"/><circle cx="124" cy="124" r="6" fill="#e88a7a" opacity=".3"/>
    <path class="npc-smile" d="M88 132 Q100 141 112 132" stroke="#8a3b3b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse class="npc-mouth" cx="100" cy="135" rx="7" ry="5" fill="#8a3b3b"/>
  </svg>`;
}

// ---------- 대사 ----------

export function mentorLines(s, { intro = false } = {}) {
  const mt = s.mentor;
  const lines = [];
  if (intro || !mt.introPop) {
    lines.push({ text: `안녕하세요, 옆자리 선배 교사 ${mt.name}입니다. 모르는 건 저한테 물어보세요.` });
    lines.push({ text: '매주 이렇게 나와서 이번 주에 할 일을 알려 드릴게요. 해내면 제가 커피값으로 1건에 1만원씩 드립니다.' });
    lines.push({ text: '훈련 일정, 교무회의 표결, 반 편성, 대결 명단이 번거로우면 왼쪽 "멘토" 칸에서 저한테 맡기셔도 돼요.' });
    if (!s.unlockAll) lines.push({ text: '처음엔 메뉴가 몇 개뿐이에요. 담임반 아이들부터 챙기시면, 때가 될 때마다 새 기능을 하나씩 열어 드릴게요.' });
  } else {
    lines.push({ text: `${s.weekLabel.split(' (')[0]}예요. ${mt.last ? (mt.last.done ? `지난주 할 일 ${mt.last.total}개 중 ${mt.last.done}개 해내셨네요. 커피값 ${mt.last.done}만원 넣어 뒀어요.` : '지난주 할 일은 못 하셨네요. 이번 주엔 같이 해 봐요.') : '이번 주도 힘내 봐요.'}` });
  }
  for (const k of newlyOpened(s)) FEATURES[k].intro.forEach((text, i, all) => lines.push({ text, href: i === all.length - 1 ? FEATURES[k].href : null, go: '보러 가기' }));
  const todo = weekTodo(s);
  todo.forEach((t, i) => lines.push({ text: `${todo.length > 1 ? `${i + 1}번째. ` : ''}${t.text}. ${t.why}`, href: t.done ? null : t.href, done: t.done }));
  if (!todo.length) lines.push({ text: '이번 주는 특별히 챙길 일이 없어요. 하고 싶은 걸 해 보세요.' });
  if (s.delegate.training) lines.push({ text: `맡겨 주신 훈련 일정은 ${autoTraining(s).why} 짜 뒀어요.` });
  lines.push({ text: '다시 듣고 싶으면 왼쪽 "멘토" 칸이나 오른쪽 아래의 저를 눌러 주세요.' });
  return lines;
}

// ---------- 화면 ----------

let open = null;

function close() {
  if (!open) return;
  clearInterval(open.timer);
  open.root.remove();
  document.removeEventListener('keydown', open.onKey);
  open = null;
  document.getElementById('npc-dock')?.removeAttribute('hidden');
}

export function showMentor(lines) {
  close();
  const s = getState();
  const root = document.createElement('div');
  root.className = 'npc-layer';
  root.setAttribute('data-raw', ''); // 세계관 용어는 미리 바꿔서 넣는다 (한 자씩 찍는 중에 바꾸면 깨짐)
  root.innerHTML = `<div class="npc-dim"></div>
    <div class="npc-wrap" role="dialog" aria-modal="true" aria-label="${esc(s.mentor.name)} 선생님">
      <div class="npc-bubble"><b class="npc-name">${esc(s.mentor.name)} ${esc(translate('선생님'))}</b><p class="npc-text" aria-live="polite"></p>
        <div class="npc-btns"><span class="npc-step note"></span><a class="btn small npc-go" hidden>하러 가기</a>
          <button type="button" class="btn small npc-end">끝내기</button><button type="button" class="btn small primary npc-next">다음 ▶</button></div></div>
      <div class="npc-figure">${mentorSvg(s.world)}</div>
    </div>`;
  document.body.appendChild(root);
  document.getElementById('npc-dock')?.setAttribute('hidden', '');
  const text = root.querySelector('.npc-text'), svg = root.querySelector('.npc-svg');
  const next = root.querySelector('.npc-next'), go = root.querySelector('.npc-go'), step = root.querySelector('.npc-step');
  const st = { i: -1, full: '', n: 0, timer: null };
  open = { root, timer: null, onKey: null };

  const typing = () => st.n < st.full.length;
  const finish = () => { clearInterval(open.timer); text.textContent = st.full; st.n = st.full.length; svg.classList.remove('talking'); };
  const show = (i) => {
    st.i = i;
    const line = lines[i];
    st.full = translate(line.text); st.n = 0; text.textContent = '';
    step.textContent = `${i + 1} / ${lines.length}`;
    next.textContent = i === lines.length - 1 ? '닫기' : '다음 ▶';
    go.hidden = !line.href; if (line.href) { go.href = line.href; go.textContent = line.go ?? '하러 가기'; }
    svg.classList.add('talking');
    clearInterval(open.timer);
    open.timer = setInterval(() => {
      st.n += 1;
      text.textContent = st.full.slice(0, st.n);
      if (!typing()) finish();
    }, TYPE_MS);
  };
  const advance = () => { if (typing()) finish(); else if (st.i < lines.length - 1) show(st.i + 1); else close(); };

  root.querySelector('.npc-dim').addEventListener('click', advance);
  root.querySelector('.npc-figure').addEventListener('click', advance);
  root.querySelector('.npc-text').addEventListener('click', advance);
  next.addEventListener('click', advance);
  root.querySelector('.npc-end').addEventListener('click', close);
  go.addEventListener('click', () => close());
  open.onKey = (e) => {
    if (e.key === 'Escape') close();
    else if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest?.('a, button:not(.npc-next)')) { e.preventDefault(); advance(); }
  };
  document.addEventListener('keydown', open.onKey);
  next.focus();
  show(0);
}

// 게임 화면마다 호출: 오른쪽 아래 멘토 버튼, 새 주의 첫 화면이면 자동 등장
export function mountMentor(hash) {
  const s = getState();
  let dock = document.getElementById('npc-dock');
  if (!dock) {
    dock = document.createElement('button');
    dock.type = 'button'; dock.id = 'npc-dock'; dock.className = 'npc-dock';
    dock.addEventListener('click', () => showMentor(mentorLines(getState())));
    document.body.appendChild(dock);
  }
  if (dock.dataset.world !== s.world || dock.dataset.name !== s.mentor.name) {
    dock.dataset.world = s.world; dock.dataset.name = s.mentor.name;
    dock.innerHTML = `${mentorSvg(s.world)}<span class="npc-dock-label">${esc(s.mentor.name)}</span>`;
    dock.setAttribute('aria-label', `${s.mentor.name} 선생님에게 이번 주 할 일 듣기`);
  }
  dock.hidden = !!open;
  const busy = s.duel && !s.duel.m.done;
  if (s.mentor.auto !== false && s.mentor.popTurn !== s.turn && !busy && !/^(ending|duel-)/.test(hash)) {
    const first = !s.mentor.introPop;
    s.mentor.popTurn = s.turn;
    s.mentor.introPop = true;
    save();
    setTimeout(() => showMentor(mentorLines(s, { intro: first })), 350);
  }
}

export function hideMentor() {
  close();
  document.getElementById('npc-dock')?.setAttribute('hidden', '');
}
