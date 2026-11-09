// 교무실: 교무회의 안건 발의와 사전 교섭, 계파 관계, 부장 자리, 학교 규칙, 교사 명단과 포섭
import { getState } from './game/state.js';
import { placeById, placeInfo } from './game/school.js';
import { threat } from './game/ai.js';
import {
  allTeachers, votesOf, postsOwned, apMaxFor, ruleOn, holderName, expectedVotes, yesChance, agendaText, proposeBlock,
  propose, lobby, cancelAgenda, recruitTeacher, recruitChance, recruitBlock, canPickTeaching, setTeaching,
  PROPOSE_AP, LOBBY_AP, RECRUIT_AP,
} from './game/politics.js';
import { SCHOOL_RULES, POSTS, AGENDA_KIND, NOCONF_NEED, ROOM_GROWTH } from './content/council.js';
import { FACTIONS, AI_FACTIONS, classLabel } from './content/factions.js';
import { notify } from './chrome.js';
import { esc } from './ui.js';
import { factionChip } from './school-view.js';

let form = { kind: 'room', target: null };
let teachFilter = 'all';
const pct = (x) => `${Math.round(x * 100)}%`;

function relLabel(v) {
  if (v >= 40) return ['우호', 'good'];
  if (v >= 10) return ['좋음', 'good'];
  if (v > -10) return ['보통', ''];
  if (v > -40) return ['나쁨', 'warn'];
  return ['적대', 'bad'];
}

export function renderOffice(app) {
  const s = getState();
  const sc = s.school;
  const votes = votesOf(s);
  const total = allTeachers(s).length;
  const a = sc.agenda;
  const th = threat(s);

  // 안건 대상 목록
  const specials = sc.places.filter((p) => placeInfo(p.id).kind === 'special' && p.owner !== 'player');
  const posts = Object.keys(POSTS).map((id) => placeById(s, id)).filter((p) => p.owner !== 'player');
  const targets = {
    room: specials.map((p) => [p.id, `${placeInfo(p.id).name} (지금 ${FACTIONS[p.owner].short})`]),
    rule: SCHOOL_RULES.map((r) => [r.id, `${r.name} ${ruleOn(s, r.id) ? '폐지' : '도입'}`]),
    noconf: posts.map((p) => [p.id, `${POSTS[p.id].name} (지금 ${FACTIONS[p.owner].short})`]),
    budget: [['budget', '담임반 학급 운영비 +10만원']],
  };
  if (!targets[form.kind].some(([id]) => id === form.target)) form.target = targets[form.kind][0]?.[0] ?? null;
  const block = form.target ? proposeBlock(s, form.kind, form.target) : '고를 수 있는 대상이 없습니다.';
  const draftAgenda = form.target ? { kind: form.kind, target: form.target, proposer: 'player', lobbied: {}, enact: form.kind === 'rule' ? !ruleOn(s, form.target) : undefined } : null;
  const draftEx = draftAgenda && !block ? expectedVotes(s, draftAgenda) : null;

  const agendaPanel = a ? (() => {
    const ex = expectedVotes(s, a);
    return `<section class="panel agenda">
      <div class="row between"><h2>이번 주 안건 <span class="note">주말 교무회의에서 표결</span></h2>
        <button type="button" class="btn small" id="cancel">거둬들이기</button></div>
      <p class="agenda-title"><span class="pill">${AGENDA_KIND[a.kind]}</span> ${esc(agendaText(s, a))}</p>
      <div class="votebar" role="img" aria-label="예상 찬성 ${ex.yes}표, 반대 ${ex.no}표, 전체 ${ex.total}표">
        <i class="yes" style="width:${(ex.yes / ex.total) * 100}%"></i><i class="no" style="width:${(ex.no / ex.total) * 100}%"></i></div>
      <p class="note">예상 찬성 <b>${ex.yes}</b> · 반대 <b>${ex.no}</b> (전체 ${ex.total}표, 과반 ${Math.floor(ex.total / 2) + 1}표). 동수면 교장이 결정합니다 (신임 50 이상이면 통과).</p>
      <h3>사전 교섭 <span class="note">${LOBBY_AP} AP · 계파마다 1번 · 찬성 확률 +25%p, 관계 +3</span></h3>
      <div class="lobby">${AI_FACTIONS.filter((f) => !sc.ai?.gone?.[f]).map((f) => {
        const p = yesChance(s, f, a);
        const done = a.lobbied[f];
        const hurt = p === 0;
        return `<div class="lobby-row">${factionChip(f)} <span class="note">${votes[f] ?? 0}표 · 찬성 확률 ${pct(p)}</span>
          ${hurt ? '<span class="note">손해 보는 쪽이라 반대</span>' : done ? '<span class="pill good">교섭함</span>'
            : `<button type="button" class="btn small" data-lobby="${f}" ${s.ap < LOBBY_AP ? 'disabled' : ''}>교섭하기</button>`}</div>`;
      }).join('')}
        <div class="lobby-row">${factionChip('none')} <span class="note">${votes.none ?? 0}표 · 한 명씩 따로 투표 · 찬성 확률 ${pct(yesChance(s, 'none', a))}</span></div>
      </div>
    </section>`;
  })() : `<section class="panel">
      <h2>안건 발의 <span class="note">${PROPOSE_AP} AP · 주 1회 · 주말 교무회의에서 표결</span></h2>
      <div class="segs" role="radiogroup" aria-label="안건 종류">${Object.entries(AGENDA_KIND).map(([k, l]) => `<label class="seg"><input type="radio" name="kind" value="${k}" ${form.kind === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <div class="row">${targets[form.kind].length ? `<select id="target" aria-label="안건 대상">${targets[form.kind].map(([id, l]) => `<option value="${id}" ${form.target === id ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : '<span class="note">고를 수 있는 대상이 없습니다.</span>'}
        <button type="button" class="btn primary" id="propose" ${block ? 'disabled' : ''}>안건 올리기</button></div>
      <p class="note">${form.kind === 'room' ? `특별실 담당권을 가져옵니다. 지금 주인 계파는 반드시 반대합니다.${ROOM_GROWTH[form.target] ? ` 효과: ${ROOM_GROWTH[form.target].text}.` : form.target ? ` 효과: ${esc(placeInfo(form.target).bonus)}.` : ''}`
        : form.kind === 'rule' ? `학교 규칙을 바꿉니다. 계파마다 좋아하는 규칙이 다릅니다. ${esc(SCHOOL_RULES.find((r) => r.id === form.target)?.desc ?? '')}.`
          : form.kind === 'noconf' ? `부장을 불신임하고 그 자리를 가져옵니다. 자격: 신임 ${NOCONF_NEED.trust} 이상, 그리고 반 ${NOCONF_NEED.classes}개 또는 대결 ${NOCONF_NEED.wins}승 이상.`
            : '학급 운영비를 10만원 늘립니다. 8주에 한 번만 올릴 수 있습니다.'}</p>
      ${block ? `<p class="field-error">${esc(block)}</p>` : draftEx ? `<p class="note">교섭 없이 올리면 예상 찬성 ${draftEx.yes} · 반대 ${draftEx.no} (과반 ${Math.floor(draftEx.total / 2) + 1}표). 올린 뒤 계파별로 사전 교섭을 할 수 있습니다.</p>` : ''}
    </section>`;

  const teachers = allTeachers(s).filter((t) => teachFilter === 'all' || t.faction === teachFilter);
  const postOf = Object.fromEntries(Object.entries(sc.postHolder).map(([p, id]) => [id, POSTS[p].name]));

  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>교무실</h1></div>
      <p class="note">교무회의에서 표를 모아 특별실 담당권, 학교 규칙, 부장 자리를 가져옵니다. 교사 한 명이 한 표입니다.</p></div>

    <div class="tiles">
      <div class="tile-stat"><span class="lbl">우리 계파 표</span><b>${votes.player ?? 1} / ${total}</b></div>
      <div class="tile-stat"><span class="lbl">부장 자리</span><b>${postsOwned(s).length} / 4 · AP 최대 ${apMaxFor(s)}</b></div>
      <div class="tile-stat"><span class="lbl">정치력</span><b>${s.teacher['정치력']}${s.profile.subject === 'social' ? ' (+사회 과목 투표 +10%)' : ''}</b></div>
      <div class="tile-stat"><span class="lbl">AI 계파의 경계</span><b class="${th.tier ? 'warn-text' : ''}">${th.label}</b></div>
    </div>

    ${agendaPanel}

    <div class="office-cols">
      <section class="panel">
        <h2>계파 관계 <span class="note">교섭하면 오르고, 손해 보는 안건·포섭 실패로 떨어집니다. -40 이하면 적대(우리를 더 노림)</span></h2>
        <div class="rels">${AI_FACTIONS.map((f) => {
          const v = sc.rel[f] ?? 0; const [l, tone] = relLabel(v);
          return `<div class="rel-row">${factionChip(f)}${sc.ai?.gone?.[f] ? '<span class="note">소멸</span>' : `<span class="relbar"><i style="left:50%;width:${Math.abs(v) / 2}%;${v < 0 ? `transform:translateX(-100%)` : ''}" class="${v < 0 ? 'neg' : 'pos'}"></i></span><span class="pill ${tone}">${l} ${v > 0 ? '+' : ''}${v}</span>`}<span class="note">${votes[f] ?? 0}표</span></div>`;
        }).join('')}</div>
      </section>
      <section class="panel">
        <h2>부장 자리 <span class="note">1개면 AP 6, 2개 이상이면 AP 7</span></h2>
        <div class="table-wrap"><table class="roster plain"><tbody>${Object.entries(POSTS).map(([id, p]) => {
          const owner = placeById(s, id).owner;
          return `<tr><td><b>${p.name}</b><br><span class="note">${esc(p.effect)}</span></td><td>${factionChip(owner)}<br><span class="note">${esc(holderName(s, id))}</span></td></tr>`;
        }).join('')}</tbody></table></div>
        ${canPickTeaching(s) ? `<div class="teach-pick"><h3>교무부장 권한: 담당 수업 반 고르기 <span class="note">학기마다 1번 · 3개</span></h3>
          <div class="chips">${sc.classes.filter((c) => c.id !== '1-4').map((c) => `<label class="chip"><input type="checkbox" value="${c.id}" ${sc.teaching.includes(c.id) ? 'checked' : ''}> ${classLabel(c.id)}</label>`).join('')}</div>
          <button type="button" class="btn small primary" id="set-teach">담당 수업 반 정하기</button></div>` : ''}
      </section>
      <section class="panel">
        <h2>학교 규칙</h2>
        <ul class="rules">${SCHOOL_RULES.map((r) => `<li><span class="pill ${ruleOn(s, r.id) ? 'good' : ''}">${ruleOn(s, r.id) ? '시행 중' : '없음'}</span> <b>${r.name}</b><br><span class="note">${r.desc} · 찬성 성향: ${Object.entries(r.pref).filter(([, v]) => v >= 0.15).map(([f]) => FACTIONS[f].short).join(', ') || '없음'} / 반대: ${Object.entries(r.pref).filter(([, v]) => v <= -0.15).map(([f]) => FACTIONS[f].short).join(', ') || '없음'}</span></li>`).join('')}</ul>
      </section>
    </div>

    <section class="panel">
      <div class="row between"><h2>교사 명단 <span class="note">교사 포섭 ${RECRUIT_AP} AP · 실패하면 그 계파와 적대 · 담임을 데려오면 그 반 지지도가 오름</span></h2>
        <div class="segs">${['all', 'player', ...AI_FACTIONS, 'none'].map((f) => `<label class="seg"><input type="radio" name="tf" value="${f}" ${teachFilter === f ? 'checked' : ''}><span>${f === 'all' ? '전체' : FACTIONS[f].short}</span></label>`).join('')}</div></div>
      <div class="table-wrap"><table class="roster plain"><thead><tr><th>교사</th><th>계파</th><th>맡은 일</th><th>정치력</th><th></th></tr></thead><tbody>
        ${teachers.map((t) => {
          const isMe = t.classId === '1-4';
          const b = recruitBlock(s, t);
          return `<tr><td><b>${esc(t.name)}</b>${isMe ? ' <span class="pill good">나</span>' : ''}</td><td>${factionChip(t.faction)}</td>
            <td>${t.classId ? `${classLabel(t.classId)} 담임` : ''}${postOf[t.id] ? `${t.classId ? ' · ' : ''}${postOf[t.id]}` : ''}</td>
            <td class="num">${isMe ? s.teacher['정치력'] : t.pol}</td>
            <td>${t.faction === 'player' ? '' : b && !b.startsWith('AP') ? `<span class="note">${esc(b)}</span>`
              : `<button type="button" class="btn small" data-recruit="${t.id}" ${b ? 'disabled' : ''}>포섭 ${pct(recruitChance(s, t))}</button>`}</td></tr>`;
        }).join('')}</tbody></table></div>
    </section>

    ${sc.council.log.length ? `<section class="panel"><h2>지난 교무회의</h2><ul class="news">${sc.council.log.slice(0, 10).map((l) => `<li><span class="pill ${l.passed ? 'good' : 'bad'}">${l.passed ? '통과' : '부결'}</span> ${esc(l.text)} <span class="note">(${FACTIONS[l.proposer].short} 발의 · ${l.yes}:${l.no})</span></li>`).join('')}</ul></section>` : ''}`;

  app.querySelectorAll('input[name=kind]').forEach((r) => r.addEventListener('change', () => { form = { kind: r.value, target: null }; rerender(); }));
  app.querySelector('#target')?.addEventListener('change', (e) => { form.target = e.target.value; rerender(); });
  app.querySelector('#propose')?.addEventListener('click', () => notify(propose(form.kind, form.target)));
  app.querySelector('#cancel')?.addEventListener('click', () => notify(cancelAgenda()));
  app.querySelectorAll('[data-lobby]').forEach((b) => b.addEventListener('click', () => notify(lobby(b.dataset.lobby))));
  app.querySelectorAll('[data-recruit]').forEach((b) => b.addEventListener('click', () => notify(recruitTeacher(b.dataset.recruit))));
  app.querySelectorAll('input[name=tf]').forEach((r) => r.addEventListener('change', () => { teachFilter = r.value; rerender(); }));
  app.querySelector('#set-teach')?.addEventListener('click', () => {
    notify(setTeaching([...app.querySelectorAll('.teach-pick input:checked')].map((x) => x.value)));
  });
  return [{ label: '교무실' }];
}

const rerender = () => window.dispatchEvent(new CustomEvent('game:changed'));
