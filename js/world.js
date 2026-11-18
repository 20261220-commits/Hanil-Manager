// 세계관 적용: 화면에 새로 그려지는 글자를 세계관 팩의 용어로 바꾼다 (규칙과 저장 데이터는 그대로)
import { WORLDS } from './content/worlds.js';

const PARTICLE = '(으로|로|을|를|은|는|이|가|와|과)?';
const hasBatchim = (ch) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? c % 28 : 0; };
// 받침 번호 (0: 없음, 8: ㄹ)
function fixParticle(word, p) {
  if (!p) return '';
  const b = hasBatchim(word[word.length - 1]);
  switch (p) {
    case '을': case '를': return b ? '을' : '를';
    case '이': case '가': return b ? '이' : '가';
    case '은': case '는': return b ? '은' : '는';
    case '와': case '과': return b ? '과' : '와';
    case '으로': case '로': return b && b !== 8 ? '으로' : '로';
    default: return p;
  }
}

let current = 'real';
let compiled = null;
let observer = null;
const done = new WeakSet();

function compile(key) {
  const w = WORLDS[key];
  if (!w || !w.terms.length) return null;
  const map = new Map(w.terms);
  const keys = [...map.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // 조사는 뒤에 한글이 더 붙지 않을 때만 고친다 ("이다", "로써" 같은 말은 그대로)
  return { re: new RegExp(`(${keys.join('|')})(?:${PARTICLE}(?![가-힣]))?`, 'g'), map };
}

export function translate(text, key = current) {
  const c = key === current ? compiled : compile(key);
  if (!c || !text) return text;
  return text.replace(c.re, (_, word, p) => { const to = c.map.get(word); return to + fixParticle(to, p); });
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE']);
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
// 원래 글자를 기억해 두었다가, 세계관이 바뀌면 원래 글자에서 다시 바꾼다
const origText = new WeakMap();
const origAttr = new WeakMap();

function walk(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const el = node.parentElement;
    if (!el || SKIP.has(el.tagName) || el.closest('[data-raw]')) return;
    if (!origText.has(node)) origText.set(node, node.nodeValue);
    const t = translate(origText.get(node));
    if (t !== node.nodeValue) node.nodeValue = t;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || SKIP.has(node.tagName) || node.hasAttribute('data-raw')) return;
  let o = origAttr.get(node);
  if (!o) { o = {}; for (const a of ATTRS) { const v = node.getAttribute(a); if (v) o[a] = v; } origAttr.set(node, o); }
  for (const a in o) node.setAttribute(a, translate(o[a]));
  for (const ch of node.childNodes) walk(ch);
}

// 세계관을 바꾼다 (real이면 원래 말)
export function setWorld(key) {
  key = WORLDS[key] ? key : 'real';
  if (key === current) return;
  current = key;
  compiled = compile(key);
  document.documentElement.dataset.world = key;
  walk(document.body);
  if (!observer) {
    observer = new MutationObserver((list) => { if (compiled) for (const m of list) for (const n of m.addedNodes) walk(n); });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
export const worldKey = () => current;
