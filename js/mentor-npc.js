// 멘토(선배 교사) NPC: 화면 오른쪽 아래에 캐릭터가 나타나 말풍선으로 이번 주 할 일을 알려 준다.
// 뒤 화면은 살짝 어두워지고, 클릭(또는 Enter)으로 다음 말풍선, "끝내기"로 닫는다. 글자는 한 자씩 빠르게 찍힌다.
import { getState, save } from './game/state.js';
import { weekTodo, autoTraining } from './game/mentor.js';
import { translate } from './world.js';
import { FEATURES, newlyOpened } from './game/unlock.js';
import { esc } from './ui.js';
import { avatarSvg, MENTOR_LOOK } from './avatar.js';

const TYPE_MS = 22; // 글자 하나 찍는 간격

// ---------- 캐릭터 그림 (세계관마다 옷차림이 다르다) ----------

export function mentorSvg(world = 'real', look = getState()?.mentor?.look) {
  return avatarSvg(look ?? MENTOR_LOOK, world, { cls: 'npc-svg', label: '선배 교사' });
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
  const sig = `${s.world}|${s.mentor.name}|${JSON.stringify(s.mentor.look)}`;
  if (dock.dataset.sig !== sig) {
    dock.dataset.sig = sig;
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
