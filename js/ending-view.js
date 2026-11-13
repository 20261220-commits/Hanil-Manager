// 결과 화면: 1막 종료(교장 추대)와 엔딩, 또는 게임 오버(전근 발령)
import { getState, save } from './game/state.js';
import { endingOf, masteryOf } from './game/routes.js';
import { conquestProgress } from './game/campaign.js';
import { ROUTES, tierOf } from './content/routes.js';
import { esc } from './ui.js';

const ENDING_TEXT = {
  '명문 교장': '대결과 교무 정치로 정정당당하게 학교를 세웠습니다. 모두가 인정하는 명문의 교장입니다.',
  '흑막 교장': '겉으로는 평범한 교사였지만, 학교의 진짜 질서는 당신의 짱들이 만들었습니다.',
  '전설의 선생님': '존경과 공포를 모두 가진 교사. 졸업생들 사이에서 전설로 남습니다.',
  '청렴한 개혁 교장': '비리를 걷어내고 원칙을 세웠습니다. 학교가 깨끗해졌습니다.',
  '전국구 명문': '학교 채널이 전국에 알려졌고, 한일고는 전국구 명문이 됐습니다.',
  '거리의 전설': '싸움 영상이 전설이 됐습니다. 동네 학생 모두가 한일고를 압니다.',
  '두 얼굴의 교장': '낮에는 정의를 외치고, 밤에는 짱들을 움직였습니다.',
  '국민 교사': '폭로와 콘텐츠로 여론을 움직였습니다. 전국이 아는 선생님입니다.',
  '이름 없는 교장': '특별한 색깔 없이 교장 자리에 올랐습니다. 어떤 교장이 될지는 이제부터입니다.',
};

const bars = (s, routes) => `<div class="route-bars">${routes.map(([k, v]) => `<div class="route-bar"><span>${k === 'ghost' && !s.routes?.ghost?.unlocked ? '???' : ROUTES[k].name.split(' ')[0]}</span><span class="meter wide"><i style="width:${v}%"></i></span><b>${v}</b><span class="note">${tierOf(v)}</span></div>`).join('')}</div>`;

function statsTable(sum, cq) {
  const rows = [['걸린 시간', sum.week], ['점령한 반', `${sum.classes} / 24`], ['확보한 장소', `${sum.places} / ${cq.placeTotal}`], ['교장 신임', sum.trust],
    ['대결 승리', sum.duelWin], ['교무회의 통과', sum.agendaPass], ['싸움 승리', sum.fightWin], ['비리 폭로', sum.expose], ['푼 괴담', sum.mystery]];
  return `<dl class="kv end-kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(String(v))}</dd>`).join('')}</dl>`;
}

export function renderEnding(app) {
  const s = getState();
  const cq = conquestProgress(s);
  let body;
  if (s.gameOver) {
    const g = s.gameOver;
    body = `
      <p class="end-kicker">게임 오버</p>
      <div class="logo end-title">${esc(g.reason)}</div>
      <p class="tagline">교장 신임이 바닥났습니다. ${esc(s.profile.title)} ${esc(s.profile.name)} 선생님은 ${esc(g.week)}, 다른 학교로 발령이 났습니다.</p>
      ${statsTable(g, cq)}
      <h2>루트 숙련도</h2>${bars(s, g.routes)}
      <div class="menu-list"><a class="menu-btn primary" href="#new"><b>새로 플레이</b><span>처음부터 다시</span></a>
        <a class="menu-btn" href="#saves"><b>세이브 파일</b><span>다른 칸 불러오기</span></a></div>`;
  } else if (s.act1) {
    const a = s.act1;
    // 숙련도 20 이상인 루트 없이 끝내면 "이름 없는 교장"
    const name = a.ending.text.startsWith('아직') ? '이름 없는 교장' : a.ending.text.split(' (')[0];
    body = `
      <p class="end-kicker">1막 완료 · ${esc(a.week)}</p>
      <div class="logo end-title">교장 추대</div>
      <p class="tagline">캠퍼스의 모든 타일을 손에 넣었습니다. 교직원들이 만장일치로 ${esc(s.profile.name)} 선생님을 교장으로 추대했습니다.</p>
      <section class="end-ending"><span class="note">엔딩</span><b>${esc(name)}</b><p>${esc(ENDING_TEXT[name] ?? '')}</p>
        ${a.ending.trueEnd ? '<p class="end-true">그리고 13번째 교실에서, 학교의 숨겨진 진실이 드러났습니다. (진엔딩)</p>' : ''}</section>
      ${statsTable(a, cq)}
      <h2>루트 숙련도</h2>${bars(s, a.routes)}
      <p class="note">한일고가 본교가 됩니다. 2막(전국 정복)은 다음 업데이트에서 이어집니다. 계속 플레이하면 지금 학교에서 이어서 할 수 있습니다.</p>
      <div class="menu-list"><button type="button" class="menu-btn primary" id="go-on"><b>계속 플레이</b><span>교장이 된 학교에서 이어서</span></button>
        <a class="menu-btn" href="#title"><b>저장하고 대기 화면으로</b><span>메뉴로 나가기</span></a></div>`;
  } else {
    const e = endingOf(s);
    body = `
      <p class="end-kicker">진행 중</p>
      <div class="logo end-title">아직 1막</div>
      <p class="tagline">반 ${cq.classes}/${cq.classTotal} · 장소 ${cq.places}/${cq.placeTotal}. 모두 점령하면 교장으로 추대됩니다.</p>
      <section class="end-ending"><span class="note">지금 엔딩 방향</span><b>${esc(e.text)}</b></section>
      ${bars(s, ['justice', 'pado', 'whistle', 'influencer', 'ghost'].map((k) => [k, masteryOf(s, k)]))}
      <div class="menu-list"><a class="menu-btn primary" href="#news"><b>돌아가기</b><span>게임으로</span></a></div>`;
  }
  app.innerHTML = `<div class="menu-screen"><div class="menu-card wide end-card">${body}</div></div>`;
  app.querySelector('#go-on')?.addEventListener('click', () => { s.act1.seen = true; save(); location.hash = 'news'; });
  return [];
}
