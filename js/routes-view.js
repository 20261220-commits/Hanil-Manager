// 특수 루트 화면 (룰북 12장): 정도 · 패도 · 내부고발자 · 인플루언서 · 괴담
import { getState } from './game/state.js';
import { rosterOf } from './game/school.js';
import { ensureRoutes, masteryOf, endingOf, justiceMastery, isOut, fightPower, influencerBonus,
  joinBroadcast, makeContent, viral, apology, investigate, BROADCAST_AP, CONTENT_AP, VIRAL_AP, APOLOGY_AP, INVESTIGATE_AP } from './game/routes.js';
import { boss, setBoss, talkBoss, fightTraining, cover, orderFight, fightBlock, ourTeam, enemyFor, TALK_AP, COVER_AP, TRAIN_AP } from './game/fight.js';
import { targets, fileOf, probe, expose, probeGain, needFor } from './game/whistle.js';
import { ROUTES, tierOf, FIGHT_TYPES, FORMATIONS, FIGHT_PLACES, PROBES, EXPOSE, EXPOSE_AP, CONCEPTS, FOLLOWER_TIERS, MYSTERIES } from './content/routes.js';
import { FACTIONS, HOMEROOM_ID, classLabel } from './content/factions.js';
import { POSTS } from './content/council.js';
import { notify } from './chrome.js';
import { esc } from './ui.js';
import { factionChip } from './school-view.js';

let ui = { tab: 'justice', type: 'duel1', target: null, form: '돌격', place: 'back', video: false, teacher: null, sin: null, cast: new Set(), concept: 'daily', viralCls: null, mystery: null, team: new Set() };
const rerender = () => window.dispatchEvent(new CustomEvent('game:changed'));
const bar = (v, tone = '') => `<span class="meter wide ${tone}"><i style="width:${v}%"></i></span>`;

export function renderRoutes(app) {
  const s = getState();
  const r = ensureRoutes(s);
  const end = endingOf(s);
  const tabs = [['justice', '정도'], ['pado', '패도'], ['whistle', '내부고발자'], ['influencer', '인플루언서'], ['ghost', r.ghost.unlocked ? '괴담' : '???']];
  const unlocked = { justice: true, pado: r.pado.unlocked, whistle: true, influencer: r.inf.unlocked, ghost: r.ghost.unlocked };

  const body = { justice: justiceTab, pado: padoTab, whistle: whistleTab, influencer: infTab, ghost: ghostTab }[ui.tab](s, r);
  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>특수 루트</h1></div>
      <p class="note">루트는 하나만 고르는 게 아니라 섞어 씁니다. 숙련도 상위 2개 루트가 엔딩을 정합니다 (입문 20 · 숙련 50 · 정점 80).</p></div>
    <section class="panel">
      <div class="row between"><h2>지금 엔딩 방향: ${esc(end.text)}</h2>${end.trueEnd ? '<span class="pill good">진엔딩 "학교의 숨겨진 진실"</span>' : ''}</div>
      <div class="route-bars">${tabs.map(([k, l]) => `<div class="route-bar ${unlocked[k] ? '' : 'locked'}"><span>${l}</span>${unlocked[k] ? `${bar(masteryOf(s, k))}<b>${masteryOf(s, k)}</b><span class="note">${tierOf(masteryOf(s, k))}</span>` : '<span class="note">잠김</span>'}</div>`).join('')}</div>
    </section>
    <div class="segs route-tabs" role="tablist">${tabs.map(([k, l]) => `<label class="seg"><input type="radio" name="rtab" value="${k}" ${ui.tab === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    ${body}`;

  app.querySelectorAll('input[name=rtab]').forEach((x) => x.addEventListener('change', () => { ui.tab = x.value; rerender(); }));
  bind(app, s);
  return [{ label: '특수 루트' }];
}

// ---------- 정도 ----------
function justiceTab(s) {
  const c = s.counters;
  const rows = [['대결 승리', c.duelWin, 3], ['방어 성공', c.defendWin, 2], ['교무회의 안건 통과', c.agendaPass, 4], ['시험 학년 1등', c.examFirst, 4], ['반장 당선', c.electionWin, 4], ['부장 자리', c.post, 6], ['반 점령', c.conquer, 6]];
  return `<section class="panel"><h2>정도 <span class="note">${ROUTES.justice.concept} · 자원: ${ROUTES.justice.resource} · 리스크: ${ROUTES.justice.risk}</span></h2>
    <p>숙련도 <b>${justiceMastery(s)}</b> (${tierOf(justiceMastery(s))}). 정도는 따로 행동이 없고, 대결과 교무 정치 실적으로 쌓입니다.</p>
    <div class="table-wrap"><table class="roster plain"><thead><tr><th>실적</th><th>횟수</th><th>1회당</th></tr></thead><tbody>${rows.map(([l, n, w]) => `<tr><td>${l}</td><td class="num">${n ?? 0}</td><td class="num">+${w}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">정도로 대결에서 이기면 그 반의 공포 지지도 10%p가 존경으로 바뀝니다. 공포로 얻은 반을 안정시키는 방법입니다.</p></section>`;
}

// ---------- 패도 ----------
function padoTab(s, r) {
  if (!r.pado.unlocked) return `<section class="panel empty"><h2>패도 루트는 잠겨 있습니다</h2><p class="muted">게임 시작 6주 뒤부터 첫 학기 동안 "옥상의 싸움" 이벤트가 일어날 수 있습니다. 그때 "지켜본다"를 고르면 열립니다. (담임반에 격투 12 이상이거나 트러블 메이커·헬창이 있으면 확률 두 배)</p></section>`;
  const b = boss(s);
  const cls = s.school.classes.filter((c) => c.id !== HOMEROOM_ID);
  if (!cls.some((c) => c.id === ui.target)) ui.target = cls[0].id;
  const block = fightBlock(s, ui.type, ui.target);
  const ours = ourTeam(s, ui.type);
  const enemy = enemyFor(s, ui.type, ui.target);
  const pend = s.inbox.filter((m) => m.choices && !m.resolved && m.ref?.studentId);
  const susp = s.students.filter((st) => isOut(s, st) && st.outWhy === '정학');
  const fears = Object.entries(r.fear).filter(([, v]) => v >= 0.5);
  const ladder = [1, 2, 3].map((g) => s.school.classes.filter((c) => c.grade === g).map((c) => {
    const top = c.id === HOMEROOM_ID ? (b ?? [...s.students].sort((x, y) => fightPower(y) - fightPower(x))[0]) : rosterOf(s, c).sort((x, y) => fightPower(y) - fightPower(x))[0];
    return { c, top, p: fightPower(top) };
  }).sort((x, y) => y.p - x.p));
  return `
    <div class="tiles">
      <div class="tile-stat"><span class="lbl">열기 (발각 위험)</span><b class="${r.pado.heat >= 50 ? 'warn-text' : ''}">${r.pado.heat}</b>${bar(r.pado.heat, r.pado.heat >= 50 ? 'bad' : r.pado.heat >= 30 ? 'warn' : 'ok')}</div>
      <div class="tile-stat"><span class="lbl">우리 짱</span><b>${b ? esc(b.name) : '없음'}</b><span class="note">${b ? `싸움 전력 ${fightPower(b).toFixed(1)} · 밀담 ${r.pado.talks}회${isOut(s, b) ? ` · ${b.outWhy}` : ''}` : ''}</span></div>
      <div class="tile-stat"><span class="lbl">비호 기록</span><b>${r.pado.cover}</b><span class="note">학폭위 발각 시 교사 연루 위험</span></div>
      <div class="tile-stat"><span class="lbl">학교 짱</span><b>${r.pado.schoolBoss ? '우리 짱' : '-'}</b></div>
    </div>
    <p class="note">열기 50 이상이면 싸움마다 (열기 - 40)% 확률로 학폭위에 발각됩니다. 매주 -3 (학생부장이면 -6). 싸움은 싸우겠다고 나선 학생끼리만 합니다.</p>
    <div class="office-cols">
      <section class="panel"><h2>짱 관리</h2>
        <div class="row"><select id="boss">${[...s.students].sort((x, y) => fightPower(y) - fightPower(x)).map((st) => `<option value="${st.id}" ${st.id === b?.id ? 'selected' : ''}>${esc(st.name)} · 전력 ${fightPower(st).toFixed(1)}${isOut(s, st) ? ` · ${st.outWhy}` : ''}</option>`).join('')}</select>
          <button type="button" class="btn small" id="set-boss">짱으로 밀기</button></div>
        <button type="button" class="btn" id="talk" ${!b || s.ap < TALK_AP ? 'disabled' : ''}>짱과 밀담 (${TALK_AP} AP)</button>
        <div class="row"><select id="train">${s.students.map((st) => `<option value="${st.id}">${esc(st.name)} · 격투 ${st.stats['격투']}</option>`).join('')}</select>
          <button type="button" class="btn small" id="train-btn" ${s.ap < TRAIN_AP ? 'disabled' : ''}>격투 특훈 (${TRAIN_AP} AP, 2주)</button></div>
      </section>
      <section class="panel"><h2>비호 <span class="note">${COVER_AP} AP · 징계 1건 무마, 비호 기록 +1</span></h2>
        ${pend.length || susp.length ? `<div class="lobby">${pend.map((m) => `<div class="lobby-row"><span>${esc(m.title)}</span><button type="button" class="btn small" data-cover="${m.id}" ${s.ap < COVER_AP ? 'disabled' : ''}>무마</button></div>`).join('')}
          ${susp.map((st) => `<div class="lobby-row"><span>${esc(st.name)} 정학</span><button type="button" class="btn small" data-cover="${st.id}" ${s.ap < COVER_AP ? 'disabled' : ''}>무마</button></div>`).join('')}</div>` : '<p class="note">무마할 징계가 없습니다.</p>'}
      </section>
    </div>
    <section class="panel agenda"><h2>싸움 지시 <span class="note">2 AP</span></h2>
      <div class="segs">${Object.entries(FIGHT_TYPES).map(([k, t]) => `<label class="seg"><input type="radio" name="ftype" value="${k}" ${ui.type === k ? 'checked' : ''}><span>${t.name}</span></label>`).join('')}</div>
      <p class="note">${FIGHT_TYPES[ui.type].desc}</p>
      ${ui.type === 'war' ? `<p>상대: 학교에서 가장 센 반 <b>${classLabel(enemy.cls.id)}</b> (${factionChip(enemy.cls.owner)})</p>` : `<div class="row"><label class="field"><span>상대 반</span><select id="ftarget">${cls.map((c) => `<option value="${c.id}" ${c.id === ui.target ? 'selected' : ''}>${classLabel(c.id)} (${FACTIONS[c.owner].short}, 공포 ${Math.round(r.fear[c.id] ?? 0)}%)</option>`).join('')}</select></label></div>`}
      ${ui.type !== 'duel1' ? `<h3>진형 <span class="note">돌격 > 포위 > 매복 > 돌격 (유리 ×1.15, 불리 ×0.90)</span></h3>
        <div class="segs">${Object.keys(FORMATIONS).map((k) => `<label class="seg"><input type="radio" name="form" value="${k}" ${ui.form === k ? 'checked' : ''}><span>${k}</span></label>`).join('')}</div>` : ''}
      <h3>장소</h3>
      <div class="segs">${Object.entries(FIGHT_PLACES).map(([k, p]) => `<label class="seg" title="${esc(p.desc)}"><input type="radio" name="place" value="${k}" ${ui.place === k ? 'checked' : ''}><span>${p.name}</span></label>`).join('')}</div>
      <p class="note">${esc(FIGHT_PLACES[ui.place].desc)}</p>
      ${r.inf.unlocked ? `<label class="row"><input type="checkbox" id="video" ${ui.video ? 'checked' : ''}> 영상으로 올리기 (조회수 ×3, 열기 +10, 논란 +10)</label>` : ''}
      <div class="office-cols"><div><h3>우리 쪽 ${ours.length}명</h3><p class="note">${ours.slice(0, 6).map((x) => `${esc(x.name)}(${fightPower(x).toFixed(1)})`).join(', ')}${ours.length > 6 ? ' 외' : ''}</p></div>
        <div><h3>상대 쪽 ${enemy.list.length}명</h3><p class="note">${enemy.list.slice(0, 6).map((x) => `${esc(x.name)}(${fightPower(x).toFixed(1)})`).join(', ')}${enemy.list.length > 6 ? ' 외' : ''}</p></div></div>
      ${block ? `<p class="field-error">${esc(block)}</p>` : ''}
      <div class="row end"><button type="button" class="btn primary big" id="fight" ${block ? 'disabled' : ''}>싸움 지시</button></div>
      ${r.pado.last ? `<div class="fight-log ${r.pado.last.won ? 'good' : 'bad'}"><ol class="mlog">${r.pado.last.log.map((l) => `<li>${esc(l)}</li>`).join('')}</ol><p><b>${esc(r.pado.last.result)}</b></p></div>` : ''}
    </section>
    <div class="office-cols">
      <section class="panel"><h2>공포 지지도 <span class="note">매주 -2%p · 공포 비중 70% 이상인 우리 반은 반란 위험</span></h2>
        ${fears.length ? `<ul class="news">${fears.map(([id, v]) => `<li>${classLabel(id)}: 공포 ${v.toFixed(1)}%p / 우리 지지도 ${Math.round(s.school.classes.find((c) => c.id === id).support.player)}%</li>`).join('')}</ul>` : '<p class="note">공포로 얻은 지지도가 없습니다.</p>'}
      </section>
      <section class="panel"><h2>서열표 <span class="note">반 짱 (반에서 싸움 전력이 가장 높은 학생)</span></h2>
        ${ladder.map((list, g) => `<h3>${g + 1}학년</h3><ol class="news">${list.slice(0, 4).map((x) => `<li class="${x.c.id === HOMEROOM_ID ? 'ours' : ''}">${esc(x.top.name)} (${classLabel(x.c.id)}) ${x.p.toFixed(1)}</li>`).join('')}</ol>`).join('')}
      </section>
    </div>`;
}

// ---------- 내부고발자 ----------
function whistleTab(s, r) {
  const list = targets(s);
  if (!list.some((t) => t.id === ui.teacher)) ui.teacher = list[0]?.id;
  const t = list.find((x) => x.id === ui.teacher);
  const f = t ? fileOf(s, t) : null;
  if (f && !f.sins.includes(ui.sin)) ui.sin = f.sins[0] ?? null;
  const post = (id) => Object.entries(s.school.postHolder).filter(([, h]) => h === id).map(([p]) => POSTS[p].name).join(', ');
  return `
    <section class="panel"><h2>내부고발자 <span class="note">AI 교사는 숨은 비리를 0~2개 가집니다. 조사하면 대상 교사의 의심이 +10, 70 이상이면 반격합니다</span></h2>
      <div class="row"><label class="field"><span>대상 교사</span><select id="teacher">${list.map((x) => { const ff = r.whistle.files[x.id]; return `<option value="${x.id}" ${x.id === ui.teacher ? 'selected' : ''}>${esc(x.name)} (${FACTIONS[x.faction].short}${x.classId ? ` · ${classLabel(x.classId)} 담임` : ''}${post(x.id) ? ` · ${post(x.id)}` : ''})${ff?.known ? (ff.sins.length ? ` · 비리 ${ff.sins.length}` : ' · 깨끗함') : ''}</option>`; }).join('')}</select></label></div>
      ${t ? `<p>${esc(t.name)} 선생님 · 의심 <b>${f.suspicion}</b> ${bar(Math.min(100, f.suspicion), f.suspicion >= 50 ? 'bad' : 'warn')}</p>
        ${f.known ? (f.sins.length ? `<div class="table-wrap"><table class="roster plain"><thead><tr><th></th><th>비리</th><th>증거</th></tr></thead><tbody>${f.sins.map((sin) => `<tr><td><input type="radio" name="sin" value="${sin}" ${ui.sin === sin ? 'checked' : ''}></td><td>${sin}</td><td>${bar(f.evidence[sin] ?? 0, (f.evidence[sin] ?? 0) >= 80 ? 'ok' : 'mid')} ${f.evidence[sin] ?? 0}%</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">이 교사는 깨끗합니다.</p>')
          : '<p class="note">아직 조사하지 않았습니다. 처음 조사하면 비리가 있는지부터 알게 됩니다.</p>'}
        <h3>조사</h3>
        <div class="acts">${Object.entries(PROBES).map(([k, p]) => `<article class="act"><header><h2>${p.name}</h2><span class="cost">${p.ap} AP</span></header><p class="note">${p.desc} · 지금 +${probeGain(s, k)}%</p>
          <button type="button" class="btn" data-probe="${k}" ${s.ap < p.ap || (f.known && !f.sins.length) ? 'disabled' : ''}>조사</button></article>`).join('')}</div>
        ${f.known && f.sins.length ? `<h3>폭로 <span class="note">${EXPOSE_AP} AP · 증거가 모자라면 무고 판정 (신임 -25, 적대)</span></h3>
          <div class="acts">${Object.entries(EXPOSE).map(([k, e]) => `<article class="act"><header><h2>${e.name}</h2><span class="cost">필요 ${needFor(s, k)}%</span></header><p class="note">${e.desc}</p>
            <button type="button" class="btn ${(f.evidence[ui.sin] ?? 0) >= needFor(s, k) ? 'primary' : ''}" data-expose="${k}" ${s.ap < EXPOSE_AP ? 'disabled' : ''}>"${esc(ui.sin)}" 폭로</button></article>`).join('')}</div>
          <p class="note">위선 리스크: 비호 기록과 들킨 조사 1개당 15% 확률로 맞폭로를 당합니다 (지금 ${r.pado.cover + r.whistle.counter}개).</p>` : ''}` : ''}
      ${r.whistle.last ? `<p class="note">최근: ${esc(r.whistle.last)}</p>` : ''}
      <p class="note">숙련 50: 익명 제보함 (매주 진행 중인 사건 증거 +3%p) · 정점 80: 언론 연결 (교육청 폭로 60%) · 인플루언서와 함께면 필요 증거 -10%p</p>
    </section>`;
}

// ---------- 인플루언서 ----------
function infTab(s, r) {
  if (!r.inf.unlocked) return `<section class="panel empty"><h2>인플루언서 루트는 잠겨 있습니다</h2>
    <p class="muted">시청각동 방송실을 차지하거나 방송부 지도교사가 되면 열립니다.</p>
    <button type="button" class="btn primary" id="join" ${s.ap < BROADCAST_AP ? 'disabled' : ''}>방송부 지도교사 지원 (${BROADCAST_AP} AP, 정치력에 따라 성공)</button></section>`;
  const cls = s.school.classes.filter((c) => c.id !== HOMEROOM_ID);
  if (!cls.some((c) => c.id === ui.viralCls)) ui.viralCls = cls[0].id;
  return `
    <div class="tiles">
      <div class="tile-stat"><span class="lbl">팔로워</span><b>${r.inf.followers.toLocaleString()}</b><span class="note">담임반 일상 영향력 +${influencerBonus(s)}%</span></div>
      <div class="tile-stat"><span class="lbl">논란</span><b class="${r.inf.ctrv >= 60 ? 'warn-text' : ''}">${r.inf.ctrv}</b>${bar(r.inf.ctrv, r.inf.ctrv >= 60 ? 'bad' : 'warn')}</div>
      <div class="tile-stat"><span class="lbl">다음 단계</span><b>${(FOLLOWER_TIERS.slice().reverse().find(([v]) => v > r.inf.followers) ?? ['최고'])[0].toLocaleString()}</b><span class="note">500 · 2,000 · 5,000 · 20,000</span></div>
    </div>
    <section class="panel"><h2>콘텐츠 제작 <span class="note">${CONTENT_AP} AP · 학생 2~3명 출연 · 팔로워는 조회수의 2% · 성향 인플루언서가 나오면 ×2</span></h2>
      <div class="segs">${Object.entries(CONCEPTS).filter(([k]) => k !== 'ghost' || r.ghost.unlocked).map(([k, c]) => `<label class="seg"><input type="radio" name="concept" value="${k}" ${ui.concept === k ? 'checked' : ''}><span>${c.name} ×${c.mult}${c.ctrv ? ` · 논란 +${c.ctrv}` : ''}</span></label>`).join('')}</div>
      <div class="chips cast">${s.students.map((st) => `<label class="chip"><input type="checkbox" data-cast="${st.id}" ${ui.cast.has(st.id) ? 'checked' : ''} ${(!ui.cast.has(st.id) && ui.cast.size >= 3) || isOut(s, st) ? 'disabled' : ''}> ${esc(st.name)}${st.trait === '인플루언서' ? ' ★' : ''}</label>`).join('')}</div>
      <button type="button" class="btn primary" id="content" ${ui.cast.size < 2 || s.ap < CONTENT_AP ? 'disabled' : ''}>촬영하기 (${ui.cast.size}명)</button>
      ${r.inf.last ? `<p class="note">최근: ${esc(r.inf.last)}</p>` : ''}
    </section>
    <div class="office-cols">
      <section class="panel"><h2>바이럴 <span class="note">${VIRAL_AP} AP · 그 반 지지도 +(팔로워 ÷ 1,000)%p, 최대 +15 · 논란 +5</span></h2>
        <div class="row"><select id="viral-cls">${cls.map((c) => `<option value="${c.id}" ${c.id === ui.viralCls ? 'selected' : ''}>${classLabel(c.id)} (우리 ${Math.round(c.support.player)}%)</option>`).join('')}</select>
          <button type="button" class="btn" id="viral" ${s.ap < VIRAL_AP ? 'disabled' : ''}>퍼뜨리기 (+${Math.min(15, r.inf.followers / 1000).toFixed(1)}%p)</button></div></section>
      <section class="panel"><h2>해명 영상 <span class="note">${APOLOGY_AP} AP · 성공하면 논란 -20, 실패하면 +10 (언어력이 높은 학생이 나섬)</span></h2>
        <button type="button" class="btn" id="apology" ${s.ap < APOLOGY_AP ? 'disabled' : ''}>해명 영상 올리기</button>
        <p class="note">논란 60 이상이면 콘텐츠마다 20% 확률로 논란 폭발: 팔로워 -30%, 신임 -10, 출연 학생 사기 -2단계.</p></section>
    </div>`;
}

// ---------- 괴담 ----------
function ghostTab(s, r) {
  if (!r.ghost.unlocked) return '<section class="panel empty"><h2>???</h2><p class="muted">아직 아무도 모르는 이야기입니다.</p></section>';
  const open = MYSTERIES.filter((m) => !m.last || r.ghost.solved.length >= 6);
  if (!open.some((m) => m.id === ui.mystery) || r.ghost.solved.includes(ui.mystery)) ui.mystery = open.find((m) => !r.ghost.solved.includes(m.id))?.id ?? null;
  const max = r.m.ghost >= 50 ? 3 : 2;
  return `
    <section class="panel"><h2>한일고 7대 불가사의 <span class="note">해결하면 영구 보너스. 13번째 교실은 앞의 6개를 풀어야 나타납니다</span></h2>
      <div class="table-wrap"><table class="roster plain"><thead><tr><th></th><th>괴담</th><th>단서</th><th>보상</th></tr></thead><tbody>
        ${MYSTERIES.map((m) => { const vis = !m.last || r.ghost.solved.length >= 6; const done = r.ghost.solved.includes(m.id); const c = r.ghost.clues[m.id] ?? 0; return `<tr class="${done ? 'ours' : ''}"><td>${vis && !done ? `<input type="radio" name="mystery" value="${m.id}" ${ui.mystery === m.id ? 'checked' : ''}>` : ''}</td>
          <td><b>${vis ? m.name : '???'}</b></td><td>${vis ? `${done ? '<span class="pill good">해결</span>' : `${bar(Math.min(100, (c / m.need) * 100), 'mid')} ${c} / ${m.need}`}` : ''}</td><td class="note">${vis ? m.reward : ''}</td></tr>`; }).join('')}</tbody></table></div>
    </section>
    <section class="panel agenda"><h2>조사 <span class="note">${INVESTIGATE_AP} AP · 학생 ${max}명까지 · 단서 +(논리력 + 기억력) ÷ 4 · 조사한 학생 광기 +(20 - 평정심 × 0.5)</span></h2>
      <div class="chips cast">${s.students.map((st) => { const m = r.ghost.madness[st.id] ?? 0; return `<label class="chip ${m >= 50 ? 'warn-text' : ''}"><input type="checkbox" data-team="${st.id}" ${ui.team.has(st.id) ? 'checked' : ''} ${(!ui.team.has(st.id) && ui.team.size >= max) || isOut(s, st) ? 'disabled' : ''}> ${esc(st.name)}${m ? ` · 광기 ${m}` : ''}${isOut(s, st) ? ` · ${st.outWhy}` : ''}</label>`; }).join('')}</div>
      <button type="button" class="btn primary" id="investigate" ${!ui.mystery || !ui.team.size || s.ap < INVESTIGATE_AP ? 'disabled' : ''}>조사 보내기</button>
      ${r.ghost.last ? `<p class="note">최근: ${esc(r.ghost.last)}</p>` : ''}
      <p class="note">광기 50 이상이면 사기가 무작위로 흔들리고, 100이면 4주 동안 실종됐다가 성향이 바뀌어 돌아옵니다. 상담하면 광기 -15, 매주 -3.</p>
    </section>`;
}

function bind(app, s) {
  const q = (sel) => app.querySelector(sel);
  // 패도
  q('#set-boss')?.addEventListener('click', () => notify(setBoss(q('#boss').value)));
  q('#talk')?.addEventListener('click', () => notify(talkBoss()));
  q('#train-btn')?.addEventListener('click', () => notify(fightTraining(q('#train').value)));
  app.querySelectorAll('[data-cover]').forEach((b) => b.addEventListener('click', () => notify(cover(b.dataset.cover))));
  app.querySelectorAll('input[name=ftype]').forEach((x) => x.addEventListener('change', () => { ui.type = x.value; rerender(); }));
  app.querySelectorAll('input[name=form]').forEach((x) => x.addEventListener('change', () => { ui.form = x.value; }));
  app.querySelectorAll('input[name=place]').forEach((x) => x.addEventListener('change', () => { ui.place = x.value; rerender(); }));
  q('#ftarget')?.addEventListener('change', (e) => { ui.target = e.target.value; rerender(); });
  q('#video')?.addEventListener('change', (e) => { ui.video = e.target.checked; });
  q('#fight')?.addEventListener('click', () => notify(orderFight({ type: ui.type, classId: ui.target, formation: ui.form, place: ui.place, video: ui.video })));
  // 내부고발자
  q('#teacher')?.addEventListener('change', (e) => { ui.teacher = e.target.value; rerender(); });
  app.querySelectorAll('input[name=sin]').forEach((x) => x.addEventListener('change', () => { ui.sin = x.value; rerender(); }));
  app.querySelectorAll('[data-probe]').forEach((b) => b.addEventListener('click', () => notify(probe(ui.teacher, ui.sin, b.dataset.probe))));
  app.querySelectorAll('[data-expose]').forEach((b) => b.addEventListener('click', () => notify(expose(ui.teacher, ui.sin, b.dataset.expose))));
  // 인플루언서
  q('#join')?.addEventListener('click', () => notify(joinBroadcast()));
  app.querySelectorAll('input[name=concept]').forEach((x) => x.addEventListener('change', () => { ui.concept = x.value; }));
  app.querySelectorAll('[data-cast]').forEach((c) => c.addEventListener('change', () => { if (c.checked) ui.cast.add(c.dataset.cast); else ui.cast.delete(c.dataset.cast); rerender(); }));
  q('#content')?.addEventListener('click', () => notify(makeContent([...ui.cast], ui.concept)));
  q('#viral-cls')?.addEventListener('change', (e) => { ui.viralCls = e.target.value; rerender(); });
  q('#viral')?.addEventListener('click', () => notify(viral(ui.viralCls)));
  q('#apology')?.addEventListener('click', () => notify(apology()));
  // 괴담
  app.querySelectorAll('input[name=mystery]').forEach((x) => x.addEventListener('change', () => { ui.mystery = x.value; }));
  app.querySelectorAll('[data-team]').forEach((c) => c.addEventListener('change', () => { if (c.checked) ui.team.add(c.dataset.team); else ui.team.delete(c.dataset.team); rerender(); }));
  q('#investigate')?.addEventListener('click', () => { const r = investigate(ui.mystery, [...ui.team]); if (r.ok) ui.team.clear(); notify(r); });
}
