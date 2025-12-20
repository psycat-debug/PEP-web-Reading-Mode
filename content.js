// content.js — PEP-web Reading Mode overlay version

let __PEP_READING_ON__ = false;
let __PEP_APP_CONTAINER__ = null;
let isSearchPopupVisible = false;

// ------- Settings -------

const DEFAULT_SETTINGS = {
  displayReferences: true,
  displayFootnotes: true,
  theme: "theme1",
};

function getUserSettings() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(
        [
          "displayReferences",
          "displayFootnotes",
          "theme",
          // Back-compat
          "hideReferences",
        ],
        (data) => {
          const settings = { ...DEFAULT_SETTINGS };

          // Back-compat: `hideReferences` (true means hide)
          if (typeof data.displayReferences === "boolean") {
            settings.displayReferences = data.displayReferences;
          } else if (typeof data.hideReferences === "boolean") {
            settings.displayReferences = !data.hideReferences;
          }

          if (typeof data.displayFootnotes === "boolean") {
            settings.displayFootnotes = data.displayFootnotes;
          }

          if (typeof data.theme === "string" && data.theme.trim()) {
            settings.theme = data.theme.trim();
          }

          resolve(settings);
        }
      );
    } catch (_e) {
      resolve({ ...DEFAULT_SETTINGS });
    }
  });
}

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
      color: var(--pep-fg, #222);
      background: var(--pep-bg, white);
    }
    #pep-reading-content {
      max-width: 50rem;
      margin: 40px auto 60px auto;
      padding: 0 24px 48px 24px;
    }
    #pep-reading-content h1, h2, h3, h4, h5, h6 {
      font-weight: bold;
      padding-top: 1rem;
      margin-top: 1.6em;
      margin-bottom: 0.6em;
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
      font-size: 1.2rem;
      margin: 0.6em 0 1.2em;
      padding: 0.75rem 0;
    }
    #pep-reading-content div[data-class="ftn_group"] > p {
      display: inline;
      margin: 0.5rem;
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
      padding: 0.3rem 1.75rem;
      border-left: 3px solid #ddd;
      background: var(--pep-box, #fafafa);
      margin-bottom: 1.5rem;
    }
    #pep-reading-content .abstract p {
      font-size: 0.95rem;
      font-style: italic;
    }
    #pep-reading-content .keywords {
      font-size: 0.9rem;
      color: #555;
      margin-bottom: 1.5rem;
    }
    #pep-reading-content .biblio,
    #pep-reading-content .summaries {
      font-size: 0.85rem;
      margin-top: 2rem;
    }

    #pep-reading-content .pep-footnotes {
      margin-top: 2.5rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(0,0,0,0.12);
    }
    #pep-reading-content .pep-footnotes h2 {
      font-size: 1.2rem;
      margin: 0 0 0.75rem 0;
    }
    #pep-reading-content .pep-footnotes p, #pep-reading-content p.bibentry {
      font-size: 0.85rem;
      padding: 0;
      margin: 0;
    }

    .pep-hidden-soft { display: none !important; }
  `;
  document.documentElement.appendChild(st);
}

function applyTheme(overlay, theme) {
  if (!overlay) return;
  overlay.classList.remove("pep-theme1", "pep-theme2", "pep-theme3");
  if (theme === "theme2") overlay.classList.add("pep-theme2");
  else if (theme === "theme3") overlay.classList.add("pep-theme3");
  else overlay.classList.add("pep-theme1");
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
    background: "var(--pep-bg, white)",
    overflow: "auto",
    display: "none",
  });

  const wrapper = document.createElement("div");
  wrapper.id = "pep-reading-content";

  const scope = getPepAppContainer() || document;

  const blocks = [
    "div.art-title",
    "div.artauth",
    "div.abstract",
    "div.keywords",
    "div#body.body, #body",
    "div.biblio",
    "div.summaries",

    // ✅ Footnotes
    'div[data-class="ftn_group"]',
  ];

  blocks.forEach((sel) => {
    const nodes = scope.querySelectorAll(sel);
    if (!nodes || nodes.length === 0) return;

    nodes.forEach((node) => {
      wrapper.appendChild(node.cloneNode(true));
    });
  });

  // ✅ fallback: based on actual DOM result, not counters
  if (wrapper.childElementCount === 0) {
    wrapper.appendChild(document.body.cloneNode(true));
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

  const scope = getPepAppContainer() || document;

  const blocks = [
    "div.art-title",
    "div.artauth",
    "div.abstract",
    "div.keywords",
    "div#body.body, #body",
    "div.biblio",
    "div.summaries",

    // ✅ Footnotes (may be multiple blocks)
    'div[data-class="ftn_group"]',
  ];

  blocks.forEach((sel) => {
    const nodes = scope.querySelectorAll(sel);
    if (!nodes || nodes.length === 0) return;
    nodes.forEach((node) => wrapper.appendChild(node.cloneNode(true)));
  });

  // ✅ fallback: no counters; check actual DOM
  if (wrapper.childElementCount === 0) {
    wrapper.appendChild(document.body.cloneNode(true));
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
function processAll(root = document, settings = DEFAULT_SETTINGS) {
  const r1 = stitchPagebreaks_SMART(root);
  const r2 = isolateAndStripLinks(root);

  if (settings?.disableBodyLinks) {
    stripAllLinks(root);
  }

  injectReadingStyle();

  // Hide references if requested（首轮处理：兼容 div.biblio + p.bibentry）
  if (!settings?.displayReferences) {
    // 整块 biblio
    root.querySelectorAll("div.biblio").forEach((el) => {
      el.classList.add("pep-hidden-soft");
    });

    // 散装 bibentry（没有 biblio wrapper 的情况）
    root.querySelectorAll("p.bibentry").forEach((p) => {
      p.classList.add("pep-hidden-soft");
    });
  }

  // Gather footnotes to the end (or remove)
  const wrapper = root.querySelector("#pep-reading-content");
  relocateFootnotes(wrapper, settings);

  // Theme
  const overlay = root.getElementById ? root.getElementById("pep-reading-root") : root;
  applyTheme(overlay, settings?.theme);

  const contentRoot = root.querySelector("#pep-reading-content") || root;
    stripAllLinks(contentRoot);

  return { ...r1, ...r2 };
}

function relocateFootnotes(wrapper, settings) {
  if (!wrapper) return;

  const footnoteBlocks = Array.from(
    wrapper.querySelectorAll('div[data-class="ftn_group"]')
  );

  // 如果本来就没有 footnotes，直接返回
  // （注意：我们不在这里创建 section）
  if (!footnoteBlocks.length) return;

  // 找/建 footnotes section（只建一次）
  let section = wrapper.querySelector(".pep-footnotes");
  if (!section) {
    section = document.createElement("div");
    section.className = "pep-footnotes";
    const h = document.createElement("h2");
    h.textContent = "Footnotes";
    section.appendChild(h);
    wrapper.appendChild(section);
  }

  // ✅ displayFootnotes = false：只隐藏 section，不删除脚注节点
  if (settings?.displayFootnotes === false) {
    section.classList.add("pep-hidden-soft");
    return;
  }

  // ✅ displayFootnotes = true：显示 section + 解除脚注内部的隐藏类
  section.classList.remove("pep-hidden-soft");

  footnoteBlocks.forEach((block) => {
    block.classList.remove("pep-hidden-soft");
    block.querySelectorAll(".pep-hidden-soft").forEach((el) => el.classList.remove("pep-hidden-soft"));
  });

  // 把所有 footnote blocks 统一移到 section 里（重复调用也安全）
  footnoteBlocks.forEach((n) => section.appendChild(n));
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
  const body = root.querySelector("div#body.body") || root.querySelector("#body");
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
    if (el.closest && el.closest('[data-pep-ui="1"]')) continue;
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

function injectOverlaySettingsPanel(overlay, initialSettings) {
  if (overlay.querySelector("#pep-settings-panel")) return;

  const panel = document.createElement("div");
  panel.id = "pep-settings-panel";
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <strong>Settings</strong>
      <button id="pep-settings-close" style="border:none;background:transparent;font-size:18px;cursor:pointer;">×</button>
    </div>

    <label style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
      <span>References</span>
      <input type="checkbox" id="pep-opt-displayReferences">
    </label>

    <label style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
      <span>Footnotes</span>
      <input type="checkbox" id="pep-opt-displayFootnotes">
    </label>

    <label style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
      <select id="pep-opt-theme">
        <option value="theme1">Classic</option>
        <option value="theme2">Paper</option>
        <option value="theme3">Night Mode</option>
      </select>
    </label>
    <div style="margin-top:12px;text-align:right;">
      <button
        id="pep-export-md-btn"
        type="button"
        style="padding:6px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.15);background:#f5f5f5;cursor:pointer;font-size:12px;"
      >
        Export to .md
      </button>
    </div>
  `;

  Object.assign(panel.style, {
    position: "fixed",
    top: "14px",
    right: "14px",
    zIndex: "999999",
    width: "160px",
    padding: "12px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.5)",
    border: "1px solid rgba(0,0,0,0.12)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    fontSize: "13px",
  });

  overlay.appendChild(panel);

  // ⭐ 新增：安全拿元素
  const refCheckbox  = panel.querySelector("#pep-opt-displayReferences");
  const ftnCheckbox  = panel.querySelector("#pep-opt-displayFootnotes");
  const themeSelect  = panel.querySelector("#pep-opt-theme");

  if (refCheckbox) {
    refCheckbox.checked = !!initialSettings.displayReferences;
  }
  if (ftnCheckbox) {
    ftnCheckbox.checked = !!initialSettings.displayFootnotes;
  }
  if (themeSelect) {
    themeSelect.value = initialSettings.theme || "theme1";
  }

  const closeBtn = panel.querySelector("#pep-settings-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      panel.remove();
    });
  }

  const onChange = () => {
    const newSettings = {
      displayReferences: refCheckbox ? refCheckbox.checked : !!initialSettings.displayReferences,
      displayFootnotes: ftnCheckbox ? ftnCheckbox.checked : !!initialSettings.displayFootnotes,
      theme: themeSelect ? themeSelect.value : (initialSettings.theme || "theme1"),
    };

    chrome.storage.sync.set(newSettings, () => {
      applySettingsToOverlay(overlay, newSettings);
    });
  };

  if (refCheckbox)  refCheckbox.addEventListener("change", onChange);
  if (ftnCheckbox)  ftnCheckbox.addEventListener("change", onChange);
  if (themeSelect)  themeSelect.addEventListener("change", onChange);

    // ⭐ Export .md
  const exportBtn = panel.querySelector("#pep-export-md-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const root = overlay.querySelector("#pep-reading-content") || overlay;
      exportReadingContentToMarkdown(root);
    });
  }
}

function applySettingsToOverlay(overlay, settings) {
  const root = overlay.querySelector("#pep-reading-content") || overlay;
console.log("[PEP] applySettingsToOverlay / refs:", settings.displayReferences,
              "found:", root.querySelectorAll("div.biblio").length);
  // 1) Theme —— ✅ apply to overlay root, not content
  applyTheme(overlay, settings.theme);

  // 2) References
  // 同时处理 div.biblio 和 p.bibentry（有 div 就整段藏，没 div 就逐行藏）
  const hide = settings.displayReferences === false;

  // 有 div.biblio 的情况：整块隐藏/显示
  root.querySelectorAll("div.biblio").forEach((el) => {
    el.classList.toggle("pep-hidden-soft", hide);
  });

  // 没有 div.biblio 时，至少把每一条 bibentry 藏起来
  root.querySelectorAll("p.bibentry").forEach((p) => {
    p.classList.toggle("pep-hidden-soft", hide);
  });

  // 3) Footnotes
  relocateFootnotes(root, settings);

}

// --- Export reading content to Markdown ---
// 导出 #pep-reading-content 为 Markdown：支持 heading / bold / italic，
// 且 #pep-reading-content 下 .quote, .poem, .dream 里的每个 <p> 前面加 ">  "
function exportReadingContentToMarkdown(root) {
  if (!root) {
    alert("No reading content to export.");
    return;
  }

  function getInlineMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue.replace(/\s+/g, " ");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();
    const inner = Array.from(node.childNodes).map(getInlineMarkdown).join("");

    if (!inner.trim()) return "";

    if (tag === "strong" || tag === "b") {
      return `**${inner.trim()}**`;
    }
    if (tag === "em" || tag === "i") {
      return `*${inner.trim()}*`;
    }
    if (tag === "br") {
      return "  \n";
    }
    if (tag === "a") {
      const href = node.getAttribute("href");
      if (href) {
        return `[${inner.trim()}](${href})`;
      }
      return inner;
    }
    // span 等其它 inline 元素，直接返回内部内容
    return inner;
  }

  function nodeToMarkdown(node) {
    let out = "";

    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.nodeValue.trim();
        if (t) {
          out += t + "\n\n";
        }
        return;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) return;

      const tag = child.tagName.toLowerCase();

      // 标题 h1-h6
      if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag[1]);
        const text = Array.from(child.childNodes).map(getInlineMarkdown).join("").trim();
        if (text) {
          out += `${"#".repeat(level)} ${text}\n\n`;
        }
        return;
      }

      // 段落 p（检查是否在 .quote / .poem / .dream 里）
      if (tag === "p") {
        const isQuote =
          child.closest(".quote") ||
          child.closest(".poem") ||
          child.closest(".dream");

        const prefix = isQuote ? ">  " : "";
        const text = Array.from(child.childNodes).map(getInlineMarkdown).join("").trim();
        if (text) {
          out += `${prefix}${text}\n\n`;
        }
        return;
      }

      // 无序 / 有序列表（简单处理）
      if (tag === "ul" || tag === "ol") {
        const isOrdered = tag === "ol";
        let index = 1;
        child.querySelectorAll(":scope > li").forEach((li) => {
          const liText = Array.from(li.childNodes).map(getInlineMarkdown).join("").trim();
          if (!liText) return;
          if (isOrdered) {
            out += `${index}. ${liText}\n`;
            index += 1;
          } else {
            out += `- ${liText}\n`;
          }
        });
        out += "\n";
        return;
      }

      // 其它 block 容器（div, section, blockquote 等）——递归
      if (["div", "section", "article", "blockquote"].includes(tag)) {
        out += nodeToMarkdown(child);
        return;
      }

      // 默认：当作 inline 容器
      out += getInlineMarkdown(child);
      out += "\n\n";
    });

    return out;
  }

  let markdown = nodeToMarkdown(root);
  // 压一下多余空行
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim() + "\n";

  // --- choose title for filename ---

  // 1️⃣ 优先用 p.document-nav-ref 里的引文信息
  // --- choose title for filename ---

  let title = "";

  // 1️⃣ 直接读源网页 document-nav-ref
  let nav =
    document.querySelector("p.document-nav-ref") ||
    document.querySelector(".document-nav-ref");

  if (nav) {
    let t = nav.textContent.trim();

    console.log("[PEP export] using SOURCE nav text:", t);

    // 去掉后面的期刊部分：
    // 在 ". " + 大写开头英文单词 之前截断
    const parts = t.split(/\. (?=[A-Z][a-z]+)/);
    t = parts[0];

    // 冒号 / 问号 → hyphen
    t = t.replace(/\s*[:?]\s*/g, " - ");

    title = t.trim();

    console.log("[PEP export] final nav-based title:", title);
  } else {
    // fallback：heading 或 document.title
    const heading =
      root.querySelector("h1") ||
      root.querySelector("h2") ||
      root.querySelector(".art-title");

    if (heading) {
      title = heading.textContent.trim();
    } else {
      title = document.title || "pep-article";
    }

    console.log("[PEP export] fallback heading title:", title);
  }

  function makeCrossPlatformFilename(title) {
    let name = title;

    // 1️⃣ 移除 Windows + mac 共同危险字符 & 控制字符
    name = name.replace(/[\\\/:*?"<>|\u0000-\u001F]/g, "");

    // 2️⃣ 压缩多余空格
    name = name.replace(/\s+/g, " ").trim();

    // 3️⃣ 移除结尾的 . 和 空格（Windows 禁止）
    name = name.replace(/[\. ]+$/g, "");

    // 4️⃣ 避免 Windows 保留文件名
    const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    if (reserved.test(name)) {
      name = "_" + name;
    }

    // 5️⃣ 保险长度（大多数 FS 限制 < 255 字符）
    if (name.length > 200) {
      name = name.slice(0, 200);
    }

    return name || "pep-article";
  }

  const filename = makeCrossPlatformFilename(title) + ".md";

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

// --- Search Popup UI and Interaction Logic ---

/**
 * Creates and injects the quick search popup into the document body.
 * Includes form fields for author and year, and handles submission.
 */
function createSearchPopup() {
    const popupHTML = `
        <div id="pep-web-search-popup" data-pep-ui="1">
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
        document.body.insertAdjacentHTML("beforeend", popupHTML);
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
      getUserSettings().then((settings) => {
        const overlay = rebuildReadingOverlay();
        overlay.style.display = "block";
        const report = processAll(overlay, settings);
        overlay.dataset.pepProcessed = "1";
        console.log("[PEP] Reading Mode ON", { report, settings });

        // ✅ inject panel + allow realtime preview
        injectOverlaySettingsPanel(overlay, settings);

        if (app) {
          if (!app.dataset.pepOrigDisplay) {
            app.dataset.pepOrigDisplay = app.style.display || "";
          }
          app.style.display = "none";
          app.setAttribute("aria-hidden", "true");
        }

        __PEP_READING_ON__ = true;
        sendResponse?.({ ok: true, mode: "on" });
      });
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
    getUserSettings().then((settings) => {
      if (!overlay.dataset.pepProcessed) {
        const report = processAll(overlay, settings);
        overlay.dataset.pepProcessed = "1";
        console.log("[PEP] Reading Mode ON via processOnce", { report, settings });
      }
      __PEP_READING_ON__ = true;
      sendResponse?.({ ok: true, mode: "on" });
    });
    return true;
  }

  if (msg?.action === "toggleSearchPopup") {
    console.log("[PEP] toggleSearchPopup message received");
    toggleSearchPopup(); 
    sendResponse?.({ ok: true });
    return true;
  }

  return true;
});
                    