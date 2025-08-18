let __PEP_DONE__ = false;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'pep/processOnce') {
    if (!__PEP_DONE__) {
      __PEP_DONE__ = true;
      const report = processAll();
      console.log('[PEP]', report);
    }
    sendResponse?.({ ok: true });
  }
  return true;
});

function processAll() {
  const r1 = stitchPagebreaks_ONLY_PARACONT();
  const r2 = isolateToArticleTrio_stripLinks();
  injectBaseStyle();
  return { ...r1, ...r2 };
}

/* ---------- Merge across <div.pagebreak> only if next is <p.paracont> ---------- */
function stitchPagebreaks_ONLY_PARACONT() {
  const breaks = Array.from(document.querySelectorAll('div.pagebreak'));
  let stitched = 0, removed = 0, hidden = 0;

  for (const pb of breaks) {
    const prev = prevElem(pb);
    const next = nextElem(pb);

    if (prev && next && prev.tagName === 'P' && next.tagName === 'P' && next.classList.contains('paracont')) {
      if (needsSpace(prev, next)) prev.appendChild(document.createTextNode(' '));
      while (next.firstChild) prev.appendChild(next.firstChild);
      pb.remove();
      next.remove();
      stitched++;
    } else {
      if (safeToRemove(pb)) { pb.remove(); removed++; }
      else { pb.style.display = 'none'; hidden++; }
    }
  }
  return { pagebreak_stitched: stitched, pagebreak_removed: removed, pagebreak_hidden: hidden };
}

// Helpers to find adjacent elements (skip empty text/comment nodes)
function prevElem(el){ let n=el.previousSibling; while(n){ if(n.nodeType===1) return n; if(n.nodeType===3 && n.textContent.trim()!=='') return null; n=n.previousSibling; } return null; }
function nextElem(el){ let n=el.nextSibling;     while(n){ if(n.nodeType===1) return n; if(n.nodeType===3 && n.textContent.trim()!=='') return null; n=n.nextSibling;     } return null; }
function needsSpace(a,b){ const t1=(a.innerText||'').trim().slice(-1), t2=(b.innerText||'').trim().charAt(0); return /[A-Za-z0-9]/.test(t1)&&/[A-Za-z0-9]/.test(t2); }
function safeToRemove(pb){ return pb.querySelectorAll('a,button,input,textarea,select,iframe,script').length===0; }

/* ---------- Keep only title/author/body/biblio/summaries; strip links in title/author ---------- */
function isolateToArticleTrio_stripLinks() {
  const title     = document.querySelector('div.art-title');
  const author    = document.querySelector('div.artauth');
  const body      = document.querySelector('div#body.body') || document.querySelector('#body');
  const biblio    = document.querySelector('div.biblio');
  const summaries = document.querySelector('div.summaries');

  // Only strip links in title/author
  [title, author].forEach(block => {
    if (!block) return;
    block.querySelectorAll('a').forEach(a => a.replaceWith(document.createTextNode(a.innerText)));
  });

  const HID = 'pep-hidden-soft';
  if (!document.getElementById('pep-isolate-style')) {
    const st = document.createElement('style');
    st.id = 'pep-isolate-style';
    st.textContent = `.${HID}{display:none!important;}`;
    document.documentElement.appendChild(st);
  }

  // Whitelist: title, author, body, biblio, summaries (and their ancestors)
  const roots = [title, author, body, biblio, summaries].filter(Boolean);
  if (!roots.length) return { isolated: false };

  const whitelist = new Set();

  const addTree = (node) => {
    if (!node || whitelist.has(node)) return;
    whitelist.add(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, null);
    while (walker.nextNode()) whitelist.add(walker.currentNode);
  };

  const addAnc = (node) => {
    let n = node?.parentElement;
    while (n && n !== document.body && n !== document.documentElement) {
      whitelist.add(n);
      n = n.parentElement;
    }
    whitelist.add(document.body);
    whitelist.add(document.documentElement);
  };

  roots.forEach(addTree);
  roots.forEach(addAnc);

  let hidden = 0;
  for (const el of document.body.getElementsByTagName('*')) {
    if (!whitelist.has(el)) { el.classList.add(HID); hidden++; }
  }
  return { isolated: true, hidden_nodes: hidden };
}

/* ---------- Minimal base style for pagebreaks ---------- */
function injectBaseStyle(){
  if (document.getElementById('pep-base-style')) return;
  const st = document.createElement('style');
  st.id = 'pep-base-style';
  st.textContent = `
    div.pagebreak { display:none!important; }
    div.pagebreak + p, p + div.pagebreak { margin-top:0!important; }
  `;
  document.documentElement.appendChild(st);
}