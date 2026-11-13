// 소식 화면 (기본 화면): 읽지 않은 소식을 한 장씩 넘겨 본다. 결정이 필요한 소식은 여기서 바로 고른다.
// 지금까지 받은 소식 목록은 "받은 편지함" 버튼으로 연다 (#inbox).
import { getState, save, studentById } from './game/state.js';
import { resolveDecision } from './game/turn.js';
import { weekLabel } from './game/calendar.js';
import { classById } from './game/school.js';
import { postsOwned } from './game/politics.js';
import { goalProgress } from './game/campaign.js';
import { notify } from './chrome.js';
import { esc, moralePill } from './ui.js';
import { HOMEROOM_ID } from './content/factions.js';
import { STATS, STAT_LABEL } from './content/stats.js';

const KIND = { event: '결정 필요', warn: '경고', report: '보고', info: '소식' };
let deck = { turn: null, ids: [], i: 0 };

const pending = (m) => !!(m.choices && !m.resolved);
const unread = (m) => !m.read || pending(m);

// 화면에 들어올 때 읽지 않은 소식으로 묶음을 만든다 (결정이 필요한 소식 먼저, 그다음 최신순)
function buildDeck(s) {
  const list = s.inbox.filter(unread).sort((a, b) => (pending(b) - pending(a)) || (b.turn - a.turn));
  const ids = list.length ? list.map((m) => m.id) : s.inbox.filter((m) => m.turn === s.turn).map((m) => m.id);
  deck = { turn: s.turn, ids: ids.length ? ids : s.inbox.slice(0, 1).map((m) => m.id), i: 0 };
}

export function renderNews(app, { fresh = false } = {}) {
  const s = getState();
  if (fresh || deck.turn !== s.turn || !deck.ids.length) buildDeck(s);
  // 그 사이 새로 온 소식(AI가 만든 프로필 이벤트 등)은 뒤에 붙인다
  for (const m of s.inbox) if (unread(m) && !deck.ids.includes(m.id)) deck.ids.push(m.id);
  deck.i = Math.min(deck.i, Math.max(0, deck.ids.length - 1));
  const m = s.inbox.find((x) => x.id === deck.ids[deck.i]);
  const left = s.inbox.filter(unread).length;

  if (!m) {
    app.innerHTML = `<div class="news-screen"><div class="panel empty"><h1>받은 소식이 없습니다</h1><a class="btn" href="#campus">캠퍼스로</a></div></div>`;
    return [{ label: '소식' }];
  }
  // 결정할 필요 없는 소식은 열면 읽은 것으로
  if (!m.read && !pending(m)) { m.read = true; save(); }

  const st = m.ref?.studentId ? studentById(m.ref.studentId) : m.persona?.studentId ? studentById(m.persona.studentId) : null;
  const tags = [KIND[m.kind] ?? '소식', m.tag, weekLabel(m.turn).split(' (')[0], st?.name].filter(Boolean);
  const paras = String(m.body ?? '').split('\n').filter(Boolean);

  app.innerHTML = `
    <div class="news-screen">
      <header class="news-top">
        <div class="news-head"><h1>소식</h1><span class="note">${left ? `읽지 않은 소식 ${left}건` : '모두 읽었습니다'} · ${deck.i + 1} / ${deck.ids.length}</span></div>
        <span class="news-date">${esc(s.weekLabel)}</span>
        ${pending(m) ? '<span class="news-flag">응답 필요</span>' : ''}
      </header>
      <div class="news-body">
        <article class="news-card k-${m.kind}">
          <h2>${esc(m.title)}</h2>
          ${paras.map((p) => `<p>${esc(p)}</p>`).join('')}
          ${m.result ? `<p class="news-result">결정: ${esc(m.result)}</p>` : ''}
          <div class="news-tags">${tags.map((t) => `<span class="news-tag">${esc(t)}</span>`).join('')}</div>
        </article>
        ${st ? studentCard(st) : teacherCard(s)}
      </div>
      <footer class="news-bar">
        ${pending(m) ? m.choices.map((c) => `<button type="button" class="btn primary news-choice" data-choice="${c.key}" title="${esc(c.desc ?? '')}"><b>${esc(c.label)}</b>${c.desc ? `<span>${esc(c.desc)}</span>` : ''}</button>`).join('') : ''}
        <a class="btn news-nav" href="#inbox">받은 편지함</a>
        <button type="button" class="btn news-nav" id="prev" ${deck.i === 0 ? 'disabled' : ''}>◀ 이전</button>
        ${deck.i < deck.ids.length - 1 ? '<button type="button" class="btn news-nav" id="next">다음 ▶</button>' : '<a class="btn news-nav" href="#campus">캠퍼스로 ▶</a>'}
      </footer>
    </div>`;

  app.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => notify(resolveDecision(m.id, b.dataset.choice))));
  app.querySelector('#prev')?.addEventListener('click', () => { deck.i--; rerender(); });
  app.querySelector('#next')?.addEventListener('click', () => { deck.i++; rerender(); });
  return [{ label: '소식' }];
}

const rerender = () => window.dispatchEvent(new CustomEvent('game:changed'));
const initial = (name) => esc(String(name ?? '?').slice(0, 1));

function teacherCard(s) {
  const home = classById(s, HOMEROOM_ID);
  const owned = s.school.classes.filter((c) => c.owner === 'player').length;
  return `<aside class="news-side">
    <div class="news-portrait"><span class="avatar">${initial(s.profile.name)}</span></div>
    <div class="news-role">담임 교사</div>
    <p class="news-sub">${esc(s.profile.title)} ${esc(s.profile.name)} 선생님</p>
    <dl class="news-kv">
      <dt>담임반</dt><dd>${esc(s.className)}</dd>
      <dt>담임반 지지도</dt><dd>${Math.round(home.support.player)}%</dd>
      <dt>교장 신임</dt><dd>${s.trust}</dd>
      <dt>학기 목표</dt><dd class="${goalProgress(s).ok ? 'ok' : ''}">${esc(goalProgress(s).now)}</dd>
      <dt>점령한 반</dt><dd>${owned} / ${s.school.classes.length}</dd>
      <dt>부장 자리</dt><dd>${postsOwned(s).length}</dd>
    </dl>
    <a class="btn small" href="#profile">프로필</a>
  </aside>`;
}

function studentCard(st) {
  const top = [...STATS].sort((a, b) => st.stats[b] - st.stats[a]).slice(0, 4);
  return `<aside class="news-side">
    <div class="news-portrait"><span class="avatar">${initial(st.name)}</span></div>
    <div class="news-role">학생</div>
    <p class="news-sub">${esc(st.name)} · ${st.no ?? '-'}번</p>
    <dl class="news-kv">
      <dt>사기</dt><dd>${moralePill(st.morale)}</dd>
      <dt>호실</dt><dd>${esc(st.room?.slice(3) ?? '-')}호</dd>
      <dt>결속도</dt><dd>${st.bond}</dd>
      ${top.map((k) => `<dt>${STAT_LABEL[k] ?? k}</dt><dd>${st.stats[k]}</dd>`).join('')}
    </dl>
    <a class="btn small" href="#s-${st.id}">학생 보기</a>
  </aside>`;
}
