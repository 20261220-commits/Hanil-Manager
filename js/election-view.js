// 반장 선거 화면 (3월 2주): 후보 정하기, 선거 운동, 예상 득표
import { getState } from './game/state.js';
import { classById } from './game/school.js';
import { ensureElection, electionOpen, setCandidate, campaign, expectedVotes, candidatePower, CAMPAIGN, CAMPAIGN_AP, ELECTION_TURN } from './game/election.js';
import { HOMEROOM_ID } from './content/factions.js';
import { notify } from './chrome.js';
import { esc, moralePill } from './ui.js';

const KEYS = ['통솔', '친화력', '언어력', '자존감', '평정심', '기획력', '창의성'];

export function renderElection(app) {
  const s = getState();
  const e = ensureElection(s);
  if (!e) {
    app.innerHTML = '<div class="panel empty"><h1>반장 선거는 끝났습니다</h1><a class="btn" href="#class">담임반으로</a></div>';
    return [{ label: '반장 선거' }];
  }
  const open = electionOpen(s);
  const ours = s.students.find((x) => x.id === e.candidate), rival = s.students.find((x) => x.id === e.rival);
  const ex = open ? expectedVotes(s) : null;
  const home = classById(s, HOMEROOM_ID);
  const card = (st, side) => `<article class="cand ${side}">
      <header><span class="pill ${side === 'ours' ? 'good' : ''}">${side === 'ours' ? '우리 쪽 후보' : '무소속 후보'}</span><h2>${esc(st.name)}</h2>${moralePill(st.morale)}</header>
      <p class="note">후보 경쟁력 ${candidatePower(st).toFixed(1)} (통솔·친화력 ×2, 언어력, 자존감, 평정심 보정)</p>
      <dl class="stats">${KEYS.map((k) => `<dt>${k}</dt><dd>${st.stats[k]}</dd>`).join('')}</dl>
    </article>`;

  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>반장 선거</h1></div>
      <p class="note">1학년 4반 학급 임원 선거. ${s.turn < ELECTION_TURN ? '다음 주' : '이번 주'} 주말에 개표합니다. 반장을 얻으면 담임반 지지도 +10%p, 이후 매주 +1%p.</p></div>

    ${e.done ? `<section class="panel result ${e.result.win ? 'good' : 'bad'}"><h2 class="result-head">${e.result.win ? '당선' : '낙선'} ${e.result.ours}:${e.result.rival}</h2></section>` : ''}

    <div class="cands">${card(ours, 'ours')}<div class="vs">대</div>${card(rival, 'rival')}</div>

    ${open ? `<section class="panel agenda">
      <h2>예상 득표 <span class="note">학생 30명 (후보 둘은 자기 자신에게 투표)</span></h2>
      <div class="votebar" role="img" aria-label="우리 후보 예상 ${ex.ours}표, 무소속 후보 ${ex.rival}표"><i class="yes" style="width:${(ex.ours / 30) * 100}%"></i><i class="no" style="width:${(ex.rival / 30) * 100}%"></i></div>
      <p class="note">우리 후보 약 <b>${ex.ours}</b>표 · 무소속 후보 약 <b>${ex.rival}</b>표 (과반 16표). 담임반 지지도 ${Math.round(home.support.player)}%, 학생마다 담임 결속도도 영향을 줍니다. 선거는 중요 대결이라 후보의 평정심이 중요합니다.</p>
      <h3>선거 운동 <span class="note">${CAMPAIGN_AP} AP · 같은 운동은 2번까지 (두 번째는 효과 절반)</span></h3>
      <div class="acts">${Object.entries(CAMPAIGN).map(([k, c]) => `<article class="act"><header><h2>${c.name}</h2><span class="cost">${CAMPAIGN_AP} AP · ${e.campaign[k] ?? 0}/2</span></header>
        <p class="note">${c.desc} (${c.stats.map((x) => `${x} ${ours.stats[x]}`).join(', ')})</p>
        <button type="button" class="btn" data-camp="${k}" ${(e.campaign[k] ?? 0) >= 2 || s.ap < CAMPAIGN_AP ? 'disabled' : ''}>하기</button></article>`).join('')}</div>
    </section>
    <section class="panel">
      <h2>후보 바꾸기 <span class="note">선거 운동을 시작하기 전까지만</span></h2>
      <div class="row"><select id="cand" ${Object.keys(e.campaign).length ? 'disabled' : ''}>${[...s.students].sort((a, b) => candidatePower(b) - candidatePower(a)).map((st) => `<option value="${st.id}" ${st.id === e.candidate ? 'selected' : ''}>${esc(st.name)} · 경쟁력 ${candidatePower(st).toFixed(1)}${st.tags.includes('leader') ? ' · 리더 후보' : ''}</option>`).join('')}</select>
        <button type="button" class="btn" id="set-cand" ${Object.keys(e.campaign).length ? 'disabled' : ''}>이 학생으로</button></div>
      <p class="note">우리 쪽 후보를 바꾸면, 남은 학생 중 가장 경쟁력 있는 학생이 무소속 후보로 나섭니다.</p>
    </section>` : ''}`;

  app.querySelectorAll('[data-camp]').forEach((b) => b.addEventListener('click', () => notify(campaign(b.dataset.camp))));
  app.querySelector('#set-cand')?.addEventListener('click', () => notify(setCandidate(app.querySelector('#cand').value)));
  return [{ label: '반장 선거' }];
}
