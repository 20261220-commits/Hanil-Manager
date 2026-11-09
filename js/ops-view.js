// 공작 화면 (반 하나): 학생 포섭, 소문 퍼뜨리기
import { getState } from './game/state.js';
import { classById, rosterOf } from './game/school.js';
import { opsBlock, recruitsOf, studentRecruitChance, recruitStudent, recruitPower, rumorPower, rumorPreview, spreadRumor, OPS_AP, SCHOLARSHIP_MAX } from './game/intrigue.js';
import { FACTIONS, FACTION_KEYS, classLabel } from './content/factions.js';
import { notify } from './chrome.js';
import { esc } from './ui.js';
import { factionChip, supportBar } from './school-view.js';

let view = { classId: null, scholarship: 0, target: null, sort: 'aff' };
const pct = (x) => `${Math.round(x * 100)}%`;

export function renderOps(app, classId) {
  const s = getState();
  const cls = classById(s, classId);
  const crumbs = [{ label: '교내 판도', href: '#school' }, { label: `${classLabel(classId)} 공작` }];
  if (!cls) { app.innerHTML = '<div class="panel empty"><h1>없는 반입니다</h1><a class="btn" href="#school">교내 판도로</a></div>'; return crumbs; }
  if (view.classId !== classId) view = { classId, scholarship: 0, target: null, sort: 'aff' };
  const block = opsBlock(s, cls);
  const mine = recruitsOf(s, classId);
  const mineIds = new Set(mine.map((r) => r.id));
  const roster = rosterOf(s, cls);
  const rivals = FACTION_KEYS.filter((f) => f !== 'player' && cls.support[f] > 0.5).sort((a, b) => cls.support[b] - cls.support[a]);
  if (!rivals.includes(view.target)) view.target = rivals[0] ?? null;
  const rp = view.target ? rumorPreview(s, cls, view.target) : null;
  const power = recruitPower(s);
  const sorted = [...roster].sort((a, b) => (view.sort === 'chance'
    ? studentRecruitChance(s, cls, b, view.scholarship) - studentRecruitChance(s, cls, a, view.scholarship)
    : b.stats['친화력'] - a.stats['친화력']));
  const rumorUsed = s.school.opsLog[`rumor:${classId}`] === s.turn;

  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>${classLabel(classId)} 공작</h1></div>
      <div class="duel-opp">${factionChip(cls.owner)} <span class="note">담임 ${esc(cls.teacher.name)} 선생님</span></div></div>
    <section class="panel"><div class="row between"><h2>지금 지지도</h2><span class="note">우리 ${Math.round(cls.support.player)}% · 우리 편 학생 ${mine.length}명</span></div>
      ${supportBar(cls.support)}
      ${mine.length ? `<p class="note">우리 편 학생: ${mine.map((r) => `${esc(r.name)}(친화력 ${r.aff})`).join(', ')} · 매주 합계 +${mine.reduce((a, r) => a + (r.aff / 20) * 0.5, 0).toFixed(1)}%p</p>` : ''}
      ${block ? `<p class="field-error">${esc(block)}</p>` : ''}</section>

    <div class="office-cols">
      <section class="panel">
        <h2>소문 퍼뜨리기 <span class="note">${OPS_AP} AP · 반마다 주 1회</span></h2>
        <p class="note">담임반에서 말 잘하고 머리 잘 돌아가는 학생 3명(언어력·창의성 평균 ${rumorPower(s).toFixed(1)})이 소문을 냅니다. 깎인 지지도는 무소속으로 갑니다.</p>
        ${rivals.length ? `<div class="row"><select id="rumor-target" aria-label="소문 대상">${rivals.map((f) => `<option value="${f}" ${view.target === f ? 'selected' : ''}>${FACTIONS[f].name} (${Math.round(cls.support[f])}%)</option>`).join('')}</select>
          <button type="button" class="btn primary" id="rumor" ${block || rumorUsed ? 'disabled' : ''}>소문 내기</button></div>
          <p class="note">예상: ${FACTIONS[view.target].short} 지지도 -${rp.drop}%p · 들킬 확률 ${pct(rp.caught)}${rumorUsed ? ' · 이번 주에 이미 소문을 냈습니다' : ''}</p>
          <p class="note">들키면 교장 신임 -10, 담임반 명성 하락, 이 반의 우리 지지도 -3%p, 그 계파와 사이가 크게 나빠집니다.</p>` : '<p class="note">소문을 낼 상대가 없습니다.</p>'}
      </section>
      <section class="panel">
        <h2>포섭 장학금 <span class="note">10만원당 성공률 +10%p · 1회 최대 ${SCHOLARSHIP_MAX}만원 · 실패해도 돌려받지 못함</span></h2>
        <div class="segs">${[0, 10, 20, 30].map((v) => `<label class="seg"><input type="radio" name="sch" value="${v}" ${view.scholarship === v ? 'checked' : ''} ${s.budget < v ? 'disabled' : ''}><span>${v ? `${v}만원` : '없음'}</span></label>`).join('')}</div>
        <p class="note">지금 예산 ${s.budget}만원. 우리 반 영입력: 친화력 상위 5명 평균 ${power.aff.toFixed(1)}, 평균 명성 별 ${power.fame.toFixed(1)}개${cls.owner === 'none' ? ' · 무소속 반이라 +20%p' : ''}.</p>
      </section>
    </div>

    <section class="panel">
      <div class="row between"><h2>학생 포섭 <span class="note">${OPS_AP} AP · 우리 편이 된 학생은 매주 (친화력 ÷ 20) × 0.5%p씩 지지도를 퍼뜨립니다</span></h2>
        <div class="segs"><label class="seg"><input type="radio" name="sort" value="aff" ${view.sort === 'aff' ? 'checked' : ''}><span>친화력 순</span></label><label class="seg"><input type="radio" name="sort" value="chance" ${view.sort === 'chance' ? 'checked' : ''}><span>성공률 순</span></label></div></div>
      ${cls.owner === 'player' ? '<p class="note">이미 우리가 점령한 반이라 포섭할 필요가 없습니다.</p>' : `
      <div class="table-wrap"><table class="roster plain"><thead><tr><th>학생</th><th>친화력</th><th>자존감</th><th>통솔</th><th>성공률</th><th></th></tr></thead><tbody>
        ${sorted.map((st) => {
          const p = studentRecruitChance(s, cls, st, view.scholarship);
          const tried = s.school.opsLog[`stu:${classId}:${st.id}`] === s.turn;
          return `<tr><td><b>${esc(st.name)}</b>${mineIds.has(st.id) ? ' <span class="pill good">우리 편</span>' : ''}</td>
            <td class="num">${st.stats['친화력']}</td><td class="num">${st.stats['자존감']}</td><td class="num">${st.stats['통솔']}</td>
            <td class="num">${mineIds.has(st.id) ? '' : pct(p)}</td>
            <td>${mineIds.has(st.id) ? '' : tried ? '<span class="note">이번 주에 설득함</span>'
              : `<button type="button" class="btn small" data-recruit="${st.id}" ${block ? 'disabled' : ''}>포섭${view.scholarship ? ` (+${view.scholarship}만원)` : ''}</button>`}</td></tr>`;
        }).join('')}</tbody></table></div>`}
      <p class="note">친화력이 높은 학생일수록 많은 지지도를 퍼뜨리고, 자존감·통솔이 높은 학생은 잘 넘어오지 않습니다. 실패하면 그 반 주인 계파와 사이가 나빠집니다.</p>
    </section>`;

  const rerender = () => window.dispatchEvent(new CustomEvent('game:changed'));
  app.querySelector('#rumor-target')?.addEventListener('change', (e) => { view.target = e.target.value; rerender(); });
  app.querySelector('#rumor')?.addEventListener('click', () => notify(spreadRumor(classId, view.target)));
  app.querySelectorAll('input[name=sch]').forEach((r) => r.addEventListener('change', () => { view.scholarship = +r.value; rerender(); }));
  app.querySelectorAll('input[name=sort]').forEach((r) => r.addEventListener('change', () => { view.sort = r.value; rerender(); }));
  app.querySelectorAll('[data-recruit]').forEach((b) => b.addEventListener('click', () => notify(recruitStudent(classId, b.dataset.recruit, view.scholarship))));
  return crumbs;
}
