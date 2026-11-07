// 받은 편지함 (아침 조회): 주간 보고, 일정, 발각 이벤트와 선택지
import { getState, save } from './game/state.js';
import { resolveDecision } from './game/turn.js';
import { weekLabel } from './game/calendar.js';
import { notify } from './chrome.js';
import { esc } from './ui.js';

const KIND = { event: '결정 필요', warn: '경고', report: '보고', info: '소식' };

export function renderInbox(app) {
  const s = getState();
  const pending = s.inbox.filter((m) => m.choices && !m.resolved);
  const rest = s.inbox.filter((m) => !(m.choices && !m.resolved));
  const byTurn = new Map();
  for (const m of rest) { if (!byTurn.has(m.turn)) byTurn.set(m.turn, []); byTurn.get(m.turn).push(m); }

  const card = (m) => `
    <article class="msg k-${m.kind}${m.read ? '' : ' unread'}">
      <header><span class="msg-kind">${KIND[m.kind] ?? '소식'}</span>${m.tag ? `<span class="msg-kind tag">${esc(m.tag)}</span>` : ''}<h2>${esc(m.title)}</h2></header>
      <p>${esc(m.body).replace(/\n/g, '<br>')}</p>
      ${m.choices && !m.resolved ? `<div class="choices">${m.choices.map((c) =>
        `<button type="button" class="btn choice" data-msg="${m.id}" data-choice="${c.key}"><b>${esc(c.label)}</b><span>${esc(c.desc)}</span></button>`).join('')}</div>` : ''}
      ${m.result ? `<p class="note">결정: ${esc(m.result)}</p>` : ''}
    </article>`;

  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>받은 편지함</h1></div></div>
    ${pending.length ? `<section class="inbox-group"><h2 class="group-title">결정이 필요한 일 ${pending.length}건</h2>${pending.map(card).join('')}</section>` : ''}
    ${[...byTurn.entries()].map(([turn, list]) => `
      <section class="inbox-group"><h2 class="group-title">${turn === s.turn ? '이번 주' : weekLabel(turn)}</h2>${list.map(card).join('')}</section>`).join('')}
    ${s.inbox.length ? '' : '<div class="panel empty"><p class="muted">받은 소식이 없습니다.</p></div>'}`;

  app.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => {
    notify(resolveDecision(b.dataset.msg, b.dataset.choice));
  }));

  // 결정이 필요 없는 소식은 열어 본 것으로 처리한다.
  let changed = false;
  for (const m of s.inbox) if (!m.read && !m.choices) { m.read = true; changed = true; }
  if (changed) save();

  return [{ label: '받은 편지함' }];
}
