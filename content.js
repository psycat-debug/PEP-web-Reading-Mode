/**
 * content.js — PEP-Web Reading Mode (well-documented edition)
 *
 * Responsibilities:
 *  - Perform "smart stitching" across <div.pagebreak> only when the next run is inline text
 *    and/or a paragraph that is known to be a continuation: <p class="paracont">.
 *  - Hide all content except title/author/body/biblio/summaries; strip links in title/author only.
 *  - Do not change font size/line-height.
 *
 * Trigger:
 *  - background.js sends { type: 'pep/processOnce' } on browser action click.
 */

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

/**
 * Orchestrates all steps:
 *  1) Smart stitching around page breaks
 *  2) Keep-only whitelist (title/author/body/biblio/summaries) + strip links in title/author
 *  3) Inject minimal base style for pagebreaks
 */
function processAll() {
  const r1 = stitchPagebreaks_SMART();
  const r2 = isolateAndStripLinks();
  injectBaseStyle();
  return { ...r1, ...r2 };
}

/* =========================================================================================
 * 1) Smart stitching around <div.pagebreak>
 * -----------------------------------------------------------------------------------------
 * Problem addressed:
 *  - In some articles, the second half of a paragraph (after a page break) can appear either:
 *      a) as a loose "inline run" (text nodes / inline elements) not wrapped by <p>, and/or
 *      b) as a proper continuation paragraph: <p class="paracont">.
 *  - We want to merge these pieces into the previous <p>, but only when it is semantically safe.
 *
 * Strategy:
 *  - For each <div.pagebreak>, if there is a left sibling paragraph (prev <p>):
 *      - Collect a "run" of inline/text nodes immediately after the pagebreak.
 *      - If the very next block is <p.paracont>, move its child nodes as well and remove it.
 *      - Insert a single ASCII space between prev <p> and the first moved node when needed
 *        (avoid word-joining in English; skip before <sup>/<sub>).
 *  - Otherwise, fall back to removing or hiding the pagebreak without stitching.
 * =========================================================================================
 */
function stitchPagebreaks_SMART() {
  const breaks = Array.from(document.querySelectorAll('div.pagebreak'));
  let stitched = 0, removed = 0, hidden = 0;

  for (const pb of breaks) {
    const prev = prevElem(pb);

    // No left paragraph to stitch into -> handle pagebreak only.
    if (!(prev && prev.tagName === 'P')) {
      if (safeToRemove(pb)) { pb.remove(); removed++; } else { pb.style.display = 'none'; hidden++; }
      continue;
    }

    // Collect a run of inline/text nodes right after the pagebreak.
    const toMove = [];
    let cursor = pb.nextSibling;
    let terminalParacont = null;

    while (cursor) {
      if (cursor.nodeType === Node.TEXT_NODE) {
        // Move text nodes as-is (including whitespace) to preserve original spacing as much as possible.
        toMove.push(cursor);
        cursor = cursor.nextSibling;
        continue;
      }

      if (cursor.nodeType === Node.ELEMENT_NODE) {
        const el = /** @type {Element} */(cursor);

        // Stop and remember if we hit a continuation paragraph: <p class="paracont">
        if (el.tagName === 'P' && el.classList.contains('paracont')) {
          terminalParacont = el;
          break;
        }

        // Treat common inline-ish elements as part of the run; stop at block-level elements.
        if (isInlineLike(el)) {
          toMove.push(el);
          cursor = el.nextSibling;
          continue;
        }
        break; // Hit a block-level / unknown element -> stop collecting.
      }

      break; // comments/others -> stop
    }

    // Decide if stitching should happen: true when we collected any inline run or found <p.paracont>.
    const shouldStitch = toMove.length > 0 || !!terminalParacont;

    if (shouldStitch) {
      // Insert a single ASCII space if needed to avoid word-joining (English).
      const firstNode = toMove[0] || (terminalParacont && terminalParacont.firstChild) || null;
      if (needsSpaceBetween(prev, firstNode)) {
        prev.appendChild(document.createTextNode(' '));
      }

      // Move the inline/text run into the left paragraph (not cloning).
      for (const n of toMove) {
        prev.appendChild(n);
      }

      // If <p.paracont> exists, move all its children into the left paragraph, then remove it.
      if (terminalParacont) {
        while (terminalParacont.firstChild) prev.appendChild(terminalParacont.firstChild);
        terminalParacont.remove();
      }

      // Finally, remove the pagebreak.
      pb.remove();
      stitched++;
    } else {
      // Not a stitchable pattern -> remove/hide the pagebreak only.
      if (safeToRemove(pb)) { pb.remove(); removed++; } else { pb.style.display = 'none'; hidden++; }
    }
  }

  return { pagebreak_stitched: stitched, pagebreak_removed: removed, pagebreak_hidden: hidden };
}

/**
 * Returns true for common inline-ish elements we are comfortable moving as part of a line.
 * Be conservative: default to false unless we positively know it's inline-like.
 * You can extend this list if PEP-Web introduces other inline wrappers after page breaks.
 */
function isInlineLike(el) {
  const inlineTags = new Set([
    'A','ABBR','B','BDI','BDO','BR','CITE','CODE','DATA','DFN','EM','I','KBD','MARK',
    'Q','RB','RP','RT','RTC','RUBY','S','SAMP','SMALL','SPAN','STRONG','SUB','SUP','TIME','U','VAR','WBR'
  ]);
  if (inlineTags.has(el.tagName)) return true;

  // Allow lone IMG to be treated inline if it appears as a continuation artifact
  if (el.tagName === 'IMG' && el.closest('p') == null) return true;

  // Explicitly block common block-level tags
  const blockTags = new Set(['P','DIV','SECTION','ARTICLE','ASIDE','HEADER','FOOTER',
                             'H1','H2','H3','H4','H5','H6','UL','OL','LI','TABLE','FIGURE','BLOCKQUOTE','PRE']);
  if (blockTags.has(el.tagName)) return false;

  // Default (conservative): treat as block-level -> stop the inline run.
  return false;
}

/**
 * Decide whether an ASCII space is needed between the left paragraph and the first moved node.
 * Avoid inserting spaces before superscripts/subscripts (common footnote marks).
 */
function needsSpaceBetween(prevP, firstNode) {
  if (!firstNode) return false;

  const lastCh = (prevP.innerText || '').trim().slice(-1);

  const startsWithAscii = (node) => {
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) {
      const c = (node.textContent || '').trim().charAt(0);
      return /[A-Za-z0-9]/.test(c);
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = /** @type {Element} */(node);
      if (el.tagName === 'SUP' || el.tagName === 'SUB') return false; // no space before footnote marks
      const c = (el.innerText || '').trim().charAt(0);
      return /[A-Za-z0-9]/.test(c);
    }
    return false;
  };

  return /[A-Za-z0-9]/.test(lastCh) && startsWithAscii(firstNode);
}

/** Safe pagebreak removal heuristic: if it has no interactive/script descendants, remove; else hide. */
function safeToRemove(pb) {
  return pb.querySelectorAll('a,button,input,textarea,select,iframe,script').length === 0;
}

/** Adjacent-element helpers: skip empty text/comment nodes; abort if a non-empty text node is in-between. */
function prevElem(el){
  let n = el.previousSibling;
  while (n) {
    if (n.nodeType === 1) return n;
    if (n.nodeType === 3 && n.textContent.trim() !== '') return null;
    n = n.previousSibling;
  }
  return null;
}
function nextElem(el){
  let n = el.nextSibling;
  while (n) {
    if (n.nodeType === 1) return n;
    if (n.nodeType === 3 && n.textContent.trim() !== '') return null;
    n = n.nextSibling;
  }
  return null;
}

/* =========================================================================================
 * 2) Keep-only whitelist and link stripping
 * -----------------------------------------------------------------------------------------
 * Whitelist roots:
 *  - div.art-title (strip all <a> inside)
 *  - div.artauth   (strip all <a> inside)
 *  - div#body.body (or fallback #body)
 *  - div.biblio
 *  - div.summaries
 *
 * All other elements are hidden with a soft CSS class.
 * =========================================================================================
 */
function isolateAndStripLinks() {
  const title     = document.querySelector('div.art-title');
  const author    = document.querySelector('div.artauth');
  const body      = document.querySelector('div#body.body') || document.querySelector('#body');
  const biblio    = document.querySelector('div.biblio');
  const summaries = document.querySelector('div.summaries');

  // Strip links inside title/author only; keep links elsewhere (e.g., references) intact.
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

  const roots = [title, author, body, biblio, summaries].filter(Boolean);
  if (!roots.length) return { isolated: false };

  // Build a whitelist: all nodes in the root subtrees + their ancestor chains.
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

/* =========================================================================================
 * 3) Minimal base style
 * -----------------------------------------------------------------------------------------
 * Keep styles minimal and local:
 *  - Ensure pagebreaks are hidden (in case any remain)
 *  - Collapse margins around removed pagebreaks to avoid visual gaps
 * =========================================================================================
 */
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