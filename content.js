// content.js — PEP-web Reading Mode overlay version

let __PEP_READING_ON__ = false;
let __PEP_APP_CONTAINER__ = null;
let isSearchPopupVisible = false;

// ------- Utility Functions -------

/**
 * Retrieves and caches the main application container element.
 * @returns {Element|null} The application container if found.
 */
function getPepAppContainer() {
  if (__PEP_APP_CONTAINER__) return __PEP_APP_CONTAINER__;
  __PEP_APP_CONTAINER__ = document.querySelector(
    ".application-container, #application-container"
  );
  return __PEP_APP_CONTAINER__;
}

/**
 * Injects CSS styles specific to the reading mode overlay.
 * Ensures consistent typography, spacing, and visual hierarchy for enhanced readability.
 */
function injectReadingStyle() {
  if (document.getElementById("pep-reading-style")) return;
  const st = document.createElement("style");
  st.id = "pep-reading-style";
  st.textContent = `
    #pep-reading-root {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      line-height: 1.6;
      color: #222;
    }
    #pep-reading-content {
      max-width: 50rem;
      margin: 40px auto 60px auto;
      padding: 0 24px 48px 24px;
    }
    #pep-reading-content h1, h2, h3, h4, h5, h6 {
      font-weight: bold;
      padding-top: 1rem;
    }
    #pep-reading-content h1 {
      font-size: 1.8rem;
    }
    #pep-reading-content h2 {
      font-size: 1.6rem;
    }
    #pep-reading-content h3 {
      font-size: 1.4rem;
    }
    #pep-reading-content .quote, .poem, .dream {
      border-left: 3px solid #C8A2C8;
      padding-left: 1rem;
      font-style: italic;
    }
    #pep-reading-content .poem p {
      padding: 0;
      margin: 0;
    }
    #pep-reading-content p {
      padding: 0.5rem 0;
      font-size: 1rem;
    }
    #pep-reading-content .art-title {
      font-size: 1.8rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }
    #pep-reading-content .artauth {
      font-size: 1rem;
      color: #555;
      margin-bottom: 1.5rem;
    }
    #pep-reading-content .abstract h1 {
      font-size: 1rem;
    }
    #pep-reading-content .abstract {
      font-size: 0.95rem;
      padding: 0.75rem 1rem;
      border-left: 3px solid #ddd;
      background: #fafafa;
      margin-bottom: 1.5rem;
    }
    #pep-reading-content .keywords {
      font-size: 0.9rem;
      color: #555;
      margin-bottom: 1.5rem;
    }
    #pep-reading-content .biblio,
    #pep-reading-content .summaries {
      font-size: 0.9rem;
      margin-top: 2rem;
    }
    .pep-hidden-soft { display: none !important; }
  `;
  document.documentElement.appendChild(st);
}

/**
 * Injects CSS styles for the quick search popup.
 * Defines layout, colors, and interaction styles for the modal dialog.
 */
function injectPopupStyle() {
  if (document.getElementById("pep-reading-style-popup")) return;

  const st = document.createElement("style");
  st.id = "pep-reading-style-popup";
  st.textContent = `
    #pep-web-search-popup {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      position: fixed;
      top: 15%;
      left: 50%;
      transform: translate(-50%, 0);
      z-index: 999999;
      padding: 20px;
      background: white;
      border: 0 solid #C8A2C8;
      border-radius: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      width: 300px;
      max-width: 90vw;
      display: none;
    }
    #pep-web-search-popup h3 {
      margin-top: 0; 
      margin-bottom: 15px; 
      font-size: 1.2rem; 
      color: #C8A2C8; 
      font-weight: bold;
    }
    #pep-web-search-popup input {
      width: 100%; 
      padding: 8px; 
      border: 1px solid #ccc; 
      border-radius: 4px;
      font-size: 1rem;
    }
    #pep-web-search-popup button {
      width: 100%; 
      padding: 10px; 
      background-color: #C8A2C8; 
      color: white;
      border: none; 
      border-radius: 4px; 
      cursor: pointer; 
      font-size: 1rem;
    }
  `;
  document.documentElement.appendChild(st);
}

// ------- Overlay Construction and Management -------

/**
 * Creates or returns the reading mode overlay element.
 * Clones key article sections (title, author, body, etc.) into a clean reading container.
 * @returns {HTMLElement} The overlay root element.
 */
function ensurePepReadingOverlay() {
  let overlay = document.getElementById("pep-reading-root");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "pep-reading-root";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "999998",
    background: "white",
    overflow: "auto",
    display: "none",
  });

  const wrapper = document.createElement("div");
  wrapper.id = "pep-reading-content";

  const doc = document;
  const blocks = [
    "div.art-title",
    "div.artauth",
    "div.abstract",
    "div.keywords",
    "div#body.body, #body",
    "div.biblio",
    "div.summaries",
  ];

  let appended = 0;
  blocks.forEach((sel) => {
    const el = doc.querySelector(sel);
    if (!el) return;
    const cloned = el.cloneNode(true);
    wrapper.appendChild(cloned);
    appended++;
  });

  if (appended === 0) {
    const fallback = doc.body.cloneNode(true);
    wrapper.appendChild(fallback);
  }

  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Rebuilds the reading overlay with fresh content from the current page.
 * Useful when navigating between articles without full page reload.
 * @returns {HTMLElement} The updated overlay.
 */
function rebuildReadingOverlay() {
  const overlay = ensurePepReadingOverlay();
  overlay.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.id = "pep-reading-content";

  const doc = document;
  const blocks = [
    "div.art-title",
    "div.artauth",
    "div.abstract",
    "div.keywords",
    "div#body.body, #body",
    "div.biblio",
    "div.summaries",
  ];

  let appended = 0;
  blocks.forEach((sel) => {
    const el = doc.querySelector(sel);
    if (!el) return;
    const cloned = el.cloneNode(true);
    wrapper.appendChild(cloned);
    appended++;
  });

  if (appended === 0) {
    const fallback = doc.body.cloneNode(true);
    wrapper.appendChild(fallback);
  }

  overlay.appendChild(wrapper);
  overlay.dataset.pepProcessed = "0";
  return overlay;
}

// ------- Core Content Processing Logic -------

/**
 * Applies all necessary transformations to the reading overlay:
 * - Stitches broken paragraphs across pagebreaks
 * - Isolates article content by hiding irrelevant DOM nodes
 * - Removes all hyperlinks for distraction-free reading
 * @param {Document|Element} root - The root element to process (usually the overlay).
 * @returns {Object} Summary of processing actions performed.
 */
function processAll(root = document) {
  const r1 = stitchPagebreaks_SMART(root);
  const r2 = isolateAndStripLinks(root);
  stripAllLinks(root);
  injectReadingStyle();
  return { ...r1, ...r2 };
}

/**
 * Finds the nearest preceding element sibling, ignoring empty text nodes.
 * @param {Node} node - Starting node.
 * @returns {Element|null} Previous element sibling or null.
 */
function prevElem(node) {
  let n = node.previousSibling;
  while (n) {
    if (n.nodeType === 1) return n;
    if (n.nodeType === 3 && n.textContent.trim() !== "") return null;
    n = n.previousSibling;
  }
  return null;
}

/**
 * Finds the nearest following element sibling, ignoring empty text nodes.
 * @param {Node} node - Starting node.
 * @returns {Element|null} Next element sibling or null.
 */
function nextElem(node) {
  let n = node.nextSibling;
  while (n) {
    if (n.nodeType === 1) return n;
    if (n.nodeType === 3 && n.textContent.trim() !== "") return null;
    n = n.nextSibling;
  }
  return null;
}

/**
 * Determines if a pagebreak element can be safely removed (always true for overlays).
 * @returns {boolean} Always true in this context.
 */
function safeToRemove(pb) {
  return true;
}

/**
 * Checks if an element behaves like an inline element.
 * @param {Element} el - The element to check.
 * @returns {boolean} True if inline-like.
 */
function isInlineLike(el) {
  const inlineTags = new Set([
    'A','SPAN','EM','STRONG','I','B','U','SMALL','SUB','SUP',
    'MARK','CODE','CITE'
  ]);
  if (inlineTags.has(el.tagName)) return true;
  const display = getComputedStyle(el).display;
  return display === 'inline' || display === 'inline-block';
}

/**
 * Determines whether a space should be inserted between two adjacent text fragments
 * to prevent unintended word concatenation (e.g., "endstart" → "end start").
 * @param {Element} leftElem - Left-side element.
 * @param {Node} firstNode - First node on the right side.
 * @returns {boolean} True if a space is needed.
 */
function needsSpaceBetween(leftElem, firstNode) {
  if (!leftElem || !firstNode) return false;

  const leftText = leftElem.textContent || '';
  const rightText = firstNode.textContent || '';

  const leftTrimmed = leftText.replace(/\s+$/,'');
  const rightTrimmed = rightText.replace(/^\s+/,'');
  if (!leftTrimmed || !rightTrimmed) return false;

  const leftLast = leftTrimmed.slice(-1);
  const rightFirst = rightTrimmed[0];

  if (/\s/.test(leftLast)) return false;
  if (/^[\s\.,;:!?\)\]]$/.test(rightFirst)) return false;

  return true;
}

/**
 * Intelligently stitches paragraphs split by pagebreak markers.
 * Merges inline content and <p class="paracont"> continuation paragraphs into the preceding <p>.
 * @param {Document|Element} root - Root to process.
 * @returns {Object} Stats on stitched/removed/hidden pagebreaks.
 */
function stitchPagebreaks_SMART(root = document) {
  const doc = root.ownerDocument || root;
  const breaks = Array.from(root.querySelectorAll('div.pagebreak'));
  let stitched = 0, removed = 0, hidden = 0;

  for (const pb of breaks) {
    const prev = prevElem(pb);

    if (!(prev && prev.tagName === 'P')) {
      if (safeToRemove(pb)) { 
        pb.remove(); 
        removed++; 
      } else { 
        pb.style.display = 'none'; 
        hidden++; 
      }
      continue;
    }

    const toMove = [];
    let cursor = pb.nextSibling;
    let terminalParacont = null;

    while (cursor) {
      if (cursor.nodeType === Node.TEXT_NODE) {
        toMove.push(cursor);
        cursor = cursor.nextSibling;
        continue;
      }

      if (cursor.nodeType === Node.ELEMENT_NODE) {
        const el = /** @type {Element} */(cursor);

        if (el.tagName === 'P' && el.classList.contains('paracont')) {
          terminalParacont = el;
          break;
        }

        if (isInlineLike(el)) {
          toMove.push(el);
          cursor = el.nextSibling;
          continue;
        }
        break;
      }

      break;
    }

    const firstNode = toMove[0] || (terminalParacont && terminalParacont.firstChild) || null;
    const shouldStitch = toMove.length > 0 || !!terminalParacont;

    if (shouldStitch) {
      if (needsSpaceBetween(prev, firstNode)) {
        prev.appendChild(doc.createTextNode(' '));
      }

      for (const n of toMove) {
        prev.appendChild(n);
      }

      if (terminalParacont) {
        while (terminalParacont.firstChild) prev.appendChild(terminalParacont.firstChild);
        terminalParacont.remove();
      }

      pb.remove();
      stitched++;
    } else {
      if (safeToRemove(pb)) { 
        pb.remove(); 
        removed++; 
      } else { 
        pb.style.display = 'none'; 
        hidden++; 
      }
    }
  }

  return { pagebreak_stitched: stitched, pagebreak_removed: removed, pagebreak_hidden: hidden };
}

/**
 * Isolates core article content by hiding all DOM nodes outside key sections.
 * Also removes links in title and author blocks to prevent navigation.
 * @param {Document|Element} root - Root to process.
 * @returns {Object} Stats on isolation results.
 */
function isolateAndStripLinks(root = document) {
  const doc = root.ownerDocument || root;

  const title = root.querySelector("div.art-title");
  const author = root.querySelector("div.artauth");
  const abstract = root.querySelector("div.abstract");
  const keywords = root.querySelector("div.keywords");
  const body =
    root.querySelector("div#body.body") || root.querySelector("#body");
  const biblio = root.querySelector("div.biblio");
  const summaries = root.querySelector("div.summaries");

  [title, author].forEach((block) => {
    if (!block) return;
    block.querySelectorAll("a").forEach((a) => {
      a.replaceWith(doc.createTextNode(a.innerText));
    });
  });

  const HID = "pep-hidden-soft";

  if (!doc.getElementById("pep-isolate-style")) {
    const st = doc.createElement("style");
    st.id = "pep-isolate-style";
    st.textContent = `.${HID}{display:none!important;}`;
    doc.documentElement.appendChild(st);
  }

  const roots = [
    title,
    author,
    abstract,
    keywords,
    body,
    biblio,
    summaries,
  ].filter(Boolean);
  if (!roots.length) return { isolated: false };

  const whitelist = new Set();

  const addTree = (node) => {
    if (!node || whitelist.has(node)) return;
    whitelist.add(node);
    const walker = doc.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, null);
    while (walker.nextNode()) {
      whitelist.add(walker.currentNode);
    }
  };

  const addAnc = (node) => {
    let n = node?.parentElement;
    while (n && n !== root && n !== doc.documentElement) {
      whitelist.add(n);
      n = n.parentElement;
    }
    whitelist.add(root);
    whitelist.add(doc.documentElement);
  };

  roots.forEach(addTree);
  roots.forEach(addAnc);

  const scope = root === doc ? doc.body : root;
  let hidden = 0;

  for (const el of scope.getElementsByTagName("*")) {
    if (!whitelist.has(el)) {
      el.classList.add(HID);
      hidden++;
    }
  }

  return { isolated: true, hidden_nodes: hidden };
}

/**
 * Removes all <a> tags by replacing them with their text content.
 * @param {Element|Document} root - Root to process.
 */
function stripAllLinks(root) {
  const links = root.querySelectorAll("a");

  links.forEach(a => {
    const text = a.textContent || "";
    const span = document.createTextNode(text);
    a.replaceWith(span);
  });
}

// --- Search Popup UI and Interaction Logic ---

/**
 * Creates and injects the quick search popup into the document body.
 * Includes form fields for author and year, and handles submission.
 */
function createSearchPopup() {
    const popupHTML = `
        <div id="pep-web-search-popup" >
            <h3>Quick Search</h3>
            <form id="pep-web-search-form">
                <div style="margin-bottom: 10px;">
                    <input type="text" id="author-input" name="author" placeholder="Author">
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="number" id="year-input" name="year" placeholder="Year" min="1800" max="2100">
                </div>
                <button type="submit">Search</button>
            </form>
        </div>
    `;

    if (!document.getElementById('pep-web-search-popup')) {
        document.body.insertAdjacentHTML('beforeend', popupHTML);
        const form = document.getElementById('pep-web-search-form');
        form.addEventListener('submit', handleSearchSubmit);
    }

    injectPopupStyle();
}

/**
 * Handles form submission from the search popup.
 * Constructs a PEP-Web search URL with author/year parameters and opens it in a new tab.
 * @param {Event} event - Form submit event.
 */
function handleSearchSubmit(event) {
    event.preventDefault();
    const author = document.getElementById('author-input').value.trim();
    const year = document.getElementById('year-input').value.trim();

    const searchTerms = [];

    if (year) {
        searchTerms.push({ "type": "startYear", "term": year });
    }
    if (author) {
        searchTerms.push({ "type": "author", "term": author });
    }

    if (searchTerms.length > 0) {
        const query = encodeURIComponent(JSON.stringify(searchTerms));
        const url = `https://pep-web.org/search?searchTerms=${query}`;
        window.open(url, '_blank');
        toggleSearchPopup(false);
        
        document.getElementById('author-input').value = '';
        document.getElementById('year-input').value = '';
    } else {
        console.error('PEP-web Search: Please enter at least an Author or a Year.');
        document.getElementById('author-input').placeholder = "AUTHOR REQUIRED";
        document.getElementById('author-input').style.borderColor = 'red';
    }
}

/**
 * Toggles visibility of the search popup.
 * Manages focus, keyboard listeners, and UI state.
 * @param {boolean} [show] - If provided, sets visibility to this value; otherwise toggles.
 */
function toggleSearchPopup(show) {
    let popup = document.getElementById('pep-web-search-popup');

    if (!popup) {
        createSearchPopup();
        popup = document.getElementById('pep-web-search-popup');
    }
    if (!popup) return;

    const authorInput = document.getElementById('author-input');

    if (show !== undefined) {
        isSearchPopupVisible = show;
    } else {
        isSearchPopupVisible = !isSearchPopupVisible;
    }

    popup.style.display = isSearchPopupVisible ? 'block' : 'none';

    if (isSearchPopupVisible && authorInput) {
        authorInput.focus();
        document.addEventListener('keydown', handleEscapeKey);
    } else {
        document.removeEventListener('keydown', handleEscapeKey);
        if (authorInput) {
            authorInput.style.borderColor = '';
            authorInput.placeholder = "Author";
        }
    }
}

/**
 * Closes the search popup when the Escape key is pressed.
 * @param {KeyboardEvent} event - Key event.
 */
function handleEscapeKey(event) {
    if (event.key === 'Escape') {
        toggleSearchPopup(false);
    }
}

// ------- Chrome Extension Message Listener -------

/**
 * Listens for messages from the extension background script.
 * Supports toggling reading mode, legacy processing, and search popup activation.
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "pep/toggleReadingMode") {
    const app = getPepAppContainer();

    if (!__PEP_READING_ON__) {
      const overlay = rebuildReadingOverlay();
      overlay.style.display = "block";
      const report = processAll(overlay);
      overlay.dataset.pepProcessed = "1";
      console.log("[PEP] Reading Mode ON", report);

      if (app) {
        if (!app.dataset.pepOrigDisplay) {
          app.dataset.pepOrigDisplay = app.style.display || "";
        }
        app.style.display = "none";
        app.setAttribute("aria-hidden", "true");
      }

      __PEP_READING_ON__ = true;
      sendResponse?.({ ok: true, mode: "on" });
    } else {
      const overlay = document.getElementById("pep-reading-root");
      if (overlay) overlay.style.display = "none";

      if (app) {
        app.style.display = app.dataset.pepOrigDisplay || "";
        app.removeAttribute("aria-hidden");

        const pbs = app.querySelectorAll("div.pagebreak");
        pbs.forEach((pb) => {
          pb.style.display = "block";
          pb.classList.remove("pep-pagebreak-hidden");
        });
      } else {
        document.querySelectorAll("div.pagebreak").forEach((pb) => {
          pb.style.display = "block";
          pb.classList.remove("pep-pagebreak-hidden");
        });
      }

      __PEP_READING_ON__ = false;
      console.log("[PEP] Reading Mode OFF");
      sendResponse?.({ ok: true, mode: "off" });
    }

    return true;
  }

  if (msg?.type === "pep/processOnce") {
    const overlay = ensurePepReadingOverlay();
    overlay.style.display = "block";
    if (!overlay.dataset.pepProcessed) {
      const report = processAll(overlay);
      overlay.dataset.pepProcessed = "1";
      console.log("[PEP] Reading Mode ON via processOnce", report);
    }
    __PEP_READING_ON__ = true;
    sendResponse?.({ ok: true, mode: "on" });
    return true;
  }

  if (msg?.action === "toggleSearchPopup") {
    toggleSearchPopup();
    sendResponse?.({ ok: true });
    return true;
  }

  return true;
});
                    