// 교사 프로필 글 입력과 특성 만들기 (새로 플레이, 프로필 화면에서 같이 쓴다)
import { aiEnabled, aiProfile } from './ai-client.js';
import { sanitizeTraits, keywordTraits, balanceOf } from './content/persona.js';
import { esc, traitCards } from './ui.js';

export const BIO_MAX = 500;
export const BIO_EXAMPLE = '예: 커피 없으면 못 사는 수학 덕후. 대학 때 축구 동아리 주장이었다. 겉으론 엄격하지만 학생 고민은 끝까지 들어 준다. 아침잠이 많다.';

// 글로 특성을 만든다. AI 서버가 있으면 AI, 실패하거나 없으면 키워드 규칙.
export async function makeTraits(bio, name, subject) {
  const text = bio.trim();
  if (aiEnabled()) {
    try {
      const r = await aiProfile(text, name, subject);
      const traits = sanitizeTraits(r.traits);
      if (traits.length) return { traits, source: 'ai', note: '' };
    } catch (err) {
      const traits = sanitizeTraits(keywordTraits(text));
      return { traits, source: 'keyword', note: `AI 서버를 쓰지 못해 키워드 규칙으로 만들었습니다 (${err.message}).` };
    }
  }
  return { traits: sanitizeTraits(keywordTraits(text)), source: 'keyword', note: '' };
}

export function bioEditor(d) {
  const len = d.bio.length;
  const bal = d.traits ? balanceOf(d.traits) : 0;
  return `
    <label class="bio-label" for="bio">자기소개 <span class="note"><span id="bio-len">${len}</span> / ${BIO_MAX}자</span></label>
    <textarea id="bio" class="bio" maxlength="${BIO_MAX}" rows="5" placeholder="${esc(BIO_EXAMPLE)}">${esc(d.bio)}</textarea>
    <div class="row">
      <button type="button" class="btn" id="make-traits" ${d.busy ? 'disabled' : ''}>${d.busy ? '만드는 중…' : d.traits ? '다시 만들기' : '특성 만들기'}</button>
      <span class="note">${aiEnabled() ? 'AI가 글을 읽고 특성을 만듭니다. 장점이 있으면 약점도 붙습니다.' : 'AI 서버가 연결되지 않아 키워드(커피, 축구, 엄격, 잠, 게임 등)로 특성을 만듭니다. 설정에서 AI 서버를 연결할 수 있습니다.'}</span>
    </div>
    ${d.note ? `<p class="field-error">${esc(d.note)}</p>` : ''}
    ${d.traits ? `<div class="ptraits-head"><b>만들어진 특성</b><span class="note">${d.source === 'ai' ? 'AI가 만듦' : '키워드 규칙으로 만듦'} · 밸런스 ${bal > 0.5 ? '조금 유리' : bal < -0.5 ? '조금 불리' : '보통'}</span></div>${traitCards(d.traits)}` : ''}`;
}

// 입력과 버튼을 연결한다. rerender: 다시 그리는 함수
export function bindBioEditor(root, d, rerender, who) {
  const ta = root.querySelector('#bio');
  if (!ta) return;
  ta.addEventListener('input', () => {
    d.bio = ta.value;
    root.querySelector('#bio-len').textContent = d.bio.length;
    if (d.traits) { d.traits = null; d.dirty = true; }
  });
  ta.addEventListener('change', () => { if (d.dirty) { d.dirty = false; rerender(); } });
  root.querySelector('#make-traits').addEventListener('click', async () => {
    if (!d.bio.trim()) { d.note = '먼저 자기소개를 써 주세요.'; rerender(); return; }
    d.busy = true; d.note = ''; rerender();
    const r = await makeTraits(d.bio, who.name, who.subject);
    Object.assign(d, r, { busy: false });
    rerender();
  });
}
