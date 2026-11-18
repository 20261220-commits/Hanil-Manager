// 학생 상세: 능력치, 성격, 성향, 상태, 욕구, 숨김 정보
import { getState, studentById } from './game/state.js';
import { doCounsel, doObserve, doFocus } from './game/turn.js';
import { notify } from './chrome.js';
import { STAT_GROUPS, STAT_LABEL, NEEDS } from './content/stats.js';
import { PERSONALITIES, TALKS } from './content/personality.js';
import { TRAITS } from './content/traits.js';
import { needLevel } from './game/students.js';
import { bodyOf, bodyType } from './game/physique.js';
import { famFor, famLabel, SPORT_POS, POS_LABEL } from './game/match.js';
import { esc, stars, moralePill, needBar, statClass, traitBadge, fameStars, LUCK_COLOR } from './ui.js';

const statName = (k) => STAT_LABEL[k] ?? k;

export function renderStudent(app, id) {
  const st = getState();
  const s = studentById(id);
  if (!s) {
    app.innerHTML = `<div class="panel empty"><h1>찾을 수 없는 학생입니다</h1><a class="btn primary" href="#class">담임반으로</a></div>`;
    return [{ label: '담임반', href: '#class' }, { label: '알 수 없음' }];
  }
  const p = PERSONALITIES.find((x) => x.name === s.personality);
  const t = TRAITS.find((x) => x.name === s.trait);
  const idx = st.students.findIndex((x) => x.id === id);
  const prev = st.students[(idx - 1 + st.students.length) % st.students.length];
  const next = st.students[(idx + 1) % st.students.length];
  const leader = s.stats['통솔'] >= 12;
  const freeObs = st.turn === 1 && st.freeObservations > 0;
  const focusing = s.focus && s.focus.until > st.turn;

  app.innerHTML = `
    <div class="bhead">
      <div>
        <span class="badge">${esc(st.className)} ${s.no}번 · 현제관 C동 ${s.room.slice(3)}호</span>
        <h1>${esc(s.name)}</h1>
        <div class="chips" style="margin-top:6px">${moralePill(s.morale)}${traitBadge(s.trait)}${leader ? '<span class="pill good">리더 기질</span>' : ''}</div>
      </div>
      <div class="pager">
        <a class="btn" href="#s-${prev.id}" aria-label="이전 학생">← ${esc(prev.name)}</a>
        <a class="btn" href="#s-${next.id}" aria-label="다음 학생">${esc(next.name)} →</a>
      </div>
    </div>

    <div class="layout">
      <div class="side-stack">
      <section class="panel">
        <h2>능력치</h2>
        <div class="statcols">${STAT_GROUPS.map((g) => `
          <div class="statcol"><h3>${g.label}</h3>
            <dl class="stats">${g.stats.map((k) => `
              <dt>${statName(k)}${k === p.up ? ' <span class="arrow up" title="성격: 성장 ↑">▲</span>' : k === p.down ? ' <span class="arrow down" title="성격: 성장 ↓">▼</span>' : ''}</dt>
              <dd class="${statClass(s.stats[k])}">${s.stats[k]}</dd>`).join('')}
            </dl></div>`).join('')}
        </div>
        <p class="note">▲▼는 성격에 따른 성장 방향입니다 (성장치 ×1.10 / ×0.90).</p>
      </section>
      ${bodyPanel(s)}
      </div>

      <aside class="side-stack">
        <section class="panel">
          <h2>능력</h2>
          <dl class="kv">
            <dt>현재 능력</dt><dd>${stars(s.ca, '현재 능력')}</dd>
            <dt>포텐</dt><dd>${s.estimate ? `${stars(s.estimate.high, '포텐 추정')} <span class="note">추정 ${s.estimate.low}~${s.estimate.high}</span>` : '<span class="note">관찰 전</span>'}</dd>
            <dt>행운</dt><dd>${s.observed ? `<span class="luck" style="background:${LUCK_COLOR[s.luck]}"></span> ${s.luck}` : '<span class="note">관찰 전</span>'}</dd>
          </dl>
        </section>

        <section class="panel">
          <h2>이번 주 행동 <span class="note">남은 AP ${st.ap}</span></h2>
          <div class="stu-acts">
            <button class="btn primary" type="button" id="counsel" ${st.ap < 1 ? 'disabled' : ''}>개인 상담 <span>1 AP</span></button>
            ${s.observed ? '' : `<button class="btn" type="button" id="observe" ${freeObs || st.ap >= 1 ? '' : 'disabled'}>학생 관찰 <span>${freeObs ? `무료 ${st.freeObservations}회 남음` : '1 AP'}</span></button>`}
          </div>
          <div class="row">
            <select id="focus-stat" aria-label="특훈할 스탯" ${focusing ? 'disabled' : ''}>${STAT_GROUPS.map((g) => `<optgroup label="${g.label}">${g.stats.map((k) => `<option value="${k}">${statName(k)} ${s.stats[k]}</option>`).join('')}</optgroup>`).join('')}</select>
            <button class="btn" type="button" id="focus" ${focusing || st.ap < 1 ? 'disabled' : ''}>개인 특훈 <span>1 AP</span></button>
          </div>
          <p class="note">${focusing ? `${statName(s.focus.stat)} 특훈 중 (성장 3배, ${s.focus.until - st.turn}주 남음)` : '특훈은 2주 동안 고른 스탯의 성장을 3배로 올립니다.'}
            ${s.lastCounsel ? ` 마지막 상담: ${st.turn - s.lastCounsel === 0 ? '이번 주' : `${st.turn - s.lastCounsel}주 전`}.` : ''}</p>
        </section>

        <section class="panel">
          <h2>상태</h2>
          <dl class="kv">
            <dt>사기</dt><dd>${moralePill(s.morale)}</dd>
            <dt>컨디션</dt><dd>${s.condition}%</dd>
            <dt>결속도</dt><dd>${s.bond} <span class="note">/ 100</span></dd>
            <dt>명성</dt><dd>${fameStars(s.fameExp)}</dd>
          </dl>
          <h3>욕구 <span class="note">최고 ${needLevel(s)}</span></h3>
          <dl class="needs">${NEEDS.map((n) => `<dt>${n.label}</dt><dd>${needBar(s.needs[n.key])}<span class="num">${s.needs[n.key]}</span></dd>`).join('')}</dl>
        </section>

        <section class="panel">
          <h2>성격 · ${p.name}</h2>
          <p>${p.effect}</p>
          <dl class="kv"><dt>성장 ↑</dt><dd>${statName(p.up)}</dd><dt>성장 ↓</dt><dd>${statName(p.down)}</dd></dl>
          <div class="talks">${TALKS.map((talk, i) => `<span><b class="talk ${p.talk[i] === '◎' ? 'good' : p.talk[i] === '✕' ? 'bad' : ''}">${p.talk[i]}</b> ${talk}</span>`).join('')}</div>
          <p class="note">훈화 반응: ◎ 잘 먹힘 · ○ 보통 · ✕ 역효과</p>
        </section>

        <section class="panel">
          <h2>성향 · ${t.name} <span class="note">${t.rarity} · ${t.tone}</span></h2>
          <p>${t.effect}</p>
        </section>
      </aside>
    </div>`;

  app.querySelector('#observe')?.addEventListener('click', () => notify(doObserve(id)));
  app.querySelector('#counsel').addEventListener('click', () => notify(doCounsel(id)));
  app.querySelector('#focus').addEventListener('click', () => notify(doFocus(id, app.querySelector('#focus-stat').value)));
  return [{ label: '담임반', href: '#class' }, { label: s.name }];
}

// 체격과 포지션 숙련도 (스포츠 대결)
const SPORT_NAME = { soccer: '축구', basketball: '농구', baseball: '야구' };
const famTone = (f) => (f >= 18 ? 'f5' : f >= 15 ? 'f4' : f >= 11 ? 'f3' : f >= 6 ? 'f2' : 'f1');
function bodyPanel(st) {
  const b = bodyOf(st);
  return `<section class="panel">
    <h2>체격과 포지션 <span class="note">키·몸무게는 포지션 적합도에 보정으로 들어갑니다 (센터·골키퍼는 키, 포수·장타는 몸무게)</span></h2>
    <div class="body-row"><div class="tile-stat"><span class="lbl">키</span><b>${b.h}cm</b></div><div class="tile-stat"><span class="lbl">몸무게</span><b>${b.w}kg</b></div><div class="tile-stat"><span class="lbl">체형</span><b>${bodyType(b)}</b></div></div>
    ${Object.keys(SPORT_POS).map((sp) => {
      const fam = famFor(st, sp);
      const list = Object.entries(fam).sort((a, c) => c[1] - a[1]);
      return `<div class="pos-row"><h3>${SPORT_NAME[sp]}</h3><div class="pos-chips">${list.map(([p, f]) => `<span class="pos-chip ${famTone(f)}" title="${famLabel(f)} ${Math.floor(f)}"><b>${POS_LABEL[p]}</b> ${famLabel(f)}</span>`).join('')}</div></div>`;
    }).join('')}
    <p class="note">포지션 숙련도: 주 포지션 100% · 능숙 96% · 가능 90% · 어색 82% · 불가 72%의 전력. 대결에서 그 자리를 뛰면 조금씩 익숙해집니다.</p>
  </section>`;
}
