(function() {
    // ==========================================
    // 0. 加载守卫 (Guard)：防止脚本被重复注入执行
    // ==========================================
    if (window.__PEP_CONTENT_SCRIPT_LOADED__) return;
    window.__PEP_CONTENT_SCRIPT_LOADED__ = true;

    // ==========================================
    // 1. 全局状态与消息监听器
    // ==========================================
    let isSearchPopupVisible = false;

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.action === "toggleReadingMode") {
            toggleReadingMode();
            sendResponse({ ok: true });
        } else if (msg.action === "toggleSearchPopup") {
            toggleSearchPopup();
            sendResponse({ ok: true });
        }
        return true;
    });

    // ==========================================
    // 2. 阅读模式 (Reading Mode) 核心逻辑
    // ==========================================
    function toggleReadingMode() {
        // 智能 Toggle：如果已经存在覆盖层，则关闭它并退出
        const existingOverlay = document.getElementById('pep-formatter-overlay');
        const existingPanel = document.getElementById('pep-formatter-panel');
        if (existingOverlay) {
            existingOverlay.remove();
            if (existingPanel) existingPanel.remove();
            return;
        }

        const originalArticle = document.querySelector('#article-content');
        if (!originalArticle) {
            alert('未找到 #article-content 元素');
            return;
        }

        // 1. 创建全屏覆盖层
        const overlay = document.createElement('div');
        overlay.id = 'pep-formatter-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #ffffff; z-index: 9999998; overflow-y: auto;
            padding: 40px 20px; box-sizing: border-box;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        // ==========================================
        // 注入样式：包括选项框颜色，以及针对打印机 (print) 的特殊优化
        // ==========================================
        const styleBlock = document.createElement('style');
        styleBlock.innerHTML = `
            #pep-formatter-panel input[type="checkbox"] { accent-color: #C8A2C8 !important; }
            
            /* 打印样式：只打印阅读层的内容，隐藏面板和原网页，且支持长文分页 */
            @media print {
                body > *:not(#pep-formatter-overlay) {
                    display: none !important;
                }
                #pep-formatter-panel, #pep-web-search-popup {
                    display: none !important;
                }
                #pep-formatter-overlay {
                    position: static !important;
                    height: auto !important;
                    overflow: visible !important;
                    padding: 0 !important;
                    background: transparent !important;
                }
            }
        `;
        overlay.appendChild(styleBlock);

        const articleClone = originalArticle.cloneNode(true);
        articleClone.style.maxWidth = '800px';
        articleClone.style.margin = '0 auto';
        articleClone.style.paddingBottom = '100px'; 
        articleClone.setAttribute('data-links-disabled', 'true'); 

        // 清理无用头部
        const h1Element = articleClone.querySelector('h1.xml-heading');
        if (h1Element) {
            let current = h1Element;
            while (current && current !== articleClone) {
                let prev = current.previousSibling;
                while (prev) {
                    let toRemove = prev;
                    prev = prev.previousSibling;
                    toRemove.remove();
                }
                current = current.parentNode;
            }
        }

        // 清理 author info
        const authorInfoSection = articleClone.querySelector('section[aria-labelledby="author-info-heading"]');
        if (authorInfoSection) authorInfoSection.remove();

        // 收集 Footnotes
        const footnotesList = articleClone.querySelectorAll('li[id^="F0"]');
        const footnoteContainer = document.createElement('div');
        footnoteContainer.id = 'pep-footnote-layer';
        footnoteContainer.style.cssText = 'margin-top: 40px; padding-top: 20px; border-top: 2px solid #eaeaea;';
        footnoteContainer.innerHTML = '<h3>Footnotes</h3>';
        
        const footnoteOl = document.createElement('ol');
        footnoteOl.style.cssText = 'list-style-type: decimal; padding-left: 40px; font-size: 0.9em; line-height: 1.6;';
        footnotesList.forEach(fn => footnoteOl.appendChild(fn)); 
        footnoteContainer.appendChild(footnoteOl);

        // 缝合断句
        const pageAnchors = articleClone.querySelectorAll('a[id^="P0"]');
        pageAnchors.forEach(anchor => {
            const pageDiv = anchor.closest('div.my-6'); 
            if (!pageDiv) return;
            const prevEl = pageDiv.previousElementSibling;
            const nextEl = pageDiv.nextElementSibling;

            if (prevEl && nextEl && prevEl.tagName === 'P' && nextEl.tagName === 'P') {
                const text1 = prevEl.innerHTML.trim();
                const text2 = nextEl.innerHTML.trim();
                if (prevEl.textContent.trim().endsWith('-')) {
                    prevEl.innerHTML = text1.slice(0, -1) + text2;
                } else {
                    prevEl.innerHTML = text1 + ' ' + text2;
                }
                nextEl.remove(); 
            }
            pageDiv.remove(); 
        });

        // 移除所有的 "Page xxx" 残留
        const allSpans = articleClone.querySelectorAll('span');
        allSpans.forEach(span => {
            if (/^Page\s+\d{1,4}$/i.test(span.textContent.trim())) {
                const pageWrapper = span.closest('div.my-6') || span.parentElement;
                if (pageWrapper) pageWrapper.remove();
            }
        });

        if (footnotesList.length > 0) articleClone.appendChild(footnoteContainer);

        // References 清理与转 ul
        const referenceContainer = articleClone.querySelector('section[role="doc-bibliography"]');
        if (referenceContainer) {
            const ignoredElements = referenceContainer.querySelectorAll('[data-reader-search-ignore="true"]');
            ignoredElements.forEach(el => el.remove());

            const refOls = referenceContainer.querySelectorAll('ol');
            refOls.forEach(ol => {
                const ul = document.createElement('ul');
                ul.innerHTML = ol.innerHTML;
                ul.className = ol.className;
                ul.style.cssText = ol.style.cssText;
                ol.parentNode.replaceChild(ul, ol);
            });
        }

        overlay.appendChild(articleClone);
        document.body.appendChild(overlay);

        // 创建控制面板
        const panel = document.createElement('div');
        panel.id = 'pep-formatter-panel';
        panel.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #ffffff;
            border: 1px solid #ddd; border-radius: 8px; padding: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999999;
            display: flex; flex-direction: column; gap: 12px;
            font-family: system-ui, sans-serif; min-width: 180px;
            user-select: none; -webkit-user-select: none;
        `;

        const panelTitle = document.createElement('div');
        panelTitle.innerText = 'PEP-web Reading Mode';
        panelTitle.style.cssText = 'font-size: 15px; font-weight: 700; color: #111; text-align: center; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 10px;';

        const refLabel = document.createElement('label');
        refLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;';
        const refCheckbox = document.createElement('input');
        refCheckbox.type = 'checkbox';
        refCheckbox.checked = true;
        refCheckbox.onchange = (e) => {
            if (referenceContainer) referenceContainer.style.display = e.target.checked ? 'block' : 'none';
        };
        refLabel.append(refCheckbox, document.createTextNode('Show References'));

        const fnLabel = document.createElement('label');
        fnLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;';
        const fnCheckbox = document.createElement('input');
        fnCheckbox.type = 'checkbox';
        fnCheckbox.checked = true;
        fnCheckbox.onchange = (e) => {
            footnoteContainer.style.display = e.target.checked ? 'block' : 'none';
        };
        fnLabel.append(fnCheckbox, document.createTextNode('Show Footnotes'));

        const linkLabel = document.createElement('label');
        linkLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;';
        const linkCheckbox = document.createElement('input');
        linkCheckbox.type = 'checkbox';
        linkCheckbox.checked = true; 
        linkCheckbox.onchange = (e) => {
            articleClone.setAttribute('data-links-disabled', e.target.checked ? 'true' : 'false');
        };
        linkLabel.append(linkCheckbox, document.createTextNode('Disable Links'));

        const exportBtn = document.createElement('button');
        exportBtn.innerText = 'Export as Markdown';
        exportBtn.style.cssText = 'background: #C8A2C8; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500; transition: background 0.2s; margin-top: 4px;';
        exportBtn.onmouseover = () => exportBtn.style.background = '#B38CB3';
        exportBtn.onmouseout = () => exportBtn.style.background = '#C8A2C8';
        exportBtn.onclick = () => {
            let filename = 'PEP_Article_Export.md'; 
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc && metaDesc.content) {
                const sanitized = metaDesc.content.replace(/[\\/:*?"<>|]/g, '-').trim();
                if (sanitized.length > 0) filename = sanitized + '.md';
            }
            downloadFile(filename, convertHtmlToMarkdown(articleClone));
        };

        const exitBtn = document.createElement('button');
        exitBtn.innerText = 'Exit reading mode';
        exitBtn.style.cssText = 'background: #C8A2C8; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500; transition: background 0.2s;';
        exitBtn.onmouseover = () => exitBtn.style.background = '#B38CB3';
        exitBtn.onmouseout = () => exitBtn.style.background = '#C8A2C8';
        exitBtn.onclick = () => {
            overlay.remove();
            panel.remove();
        };

        const authorInfo = document.createElement('div');
        authorInfo.innerHTML = 'author: <a href="https://github.com/psycat-debug/" target="_blank" style="color: #C8A2C8; text-decoration: none; font-weight: 500;">psycat-debug</a>';
        authorInfo.style.cssText = 'font-size: 12px; color: #888; text-align: center; margin-top: 2px;';

        panel.append(panelTitle, refLabel, fnLabel, linkLabel, document.createElement('hr'), exportBtn, exitBtn, authorInfo);
        document.body.appendChild(panel);

        // ---- Helper Functions (Scoped) ----
        function convertHtmlToMarkdown(node) {
            let md = "";
            function traverse(currentNode) {
                if (currentNode.nodeType === 1 && currentNode.style.display === 'none') return;
                for (let child of currentNode.childNodes) {
                    if (child.nodeType === 3) { 
                        const text = child.nodeValue.replace(/\s+/g, ' ');
                        md += text.trim() !== "" ? text : " ";
                    } else if (child.nodeType === 1) {
                        if (child.style.display === 'none') continue;
                        const tag = child.tagName.toLowerCase();
                        if (tag === 'h1') { md += '\n# '; traverse(child); md += '\n\n'; }
                        else if (tag === 'h2') { md += '\n## '; traverse(child); md += '\n\n'; }
                        else if (tag === 'h3') { md += '\n### '; traverse(child); md += '\n\n'; }
                        else if (tag === 'p') { md += '\n'; traverse(child); md += '\n\n'; }
                        else if (tag === 'strong' || tag === 'b' || tag === 'em' || tag === 'i') {
                            let startLen = md.length;
                            traverse(child);
                            let innerText = md.substring(startLen);
                            md = md.substring(0, startLen);
                            let leadingSpaces = innerText.match(/^\s+/)?.[0] || '';
                            let trailingSpaces = innerText.match(/\s+$/)?.[0] || '';
                            let coreText = innerText.trim();
                            if (coreText) {
                                let mkPrefix = (tag === 'strong' || tag === 'b') ? '**' : '*';
                                md += leadingSpaces + mkPrefix + coreText + mkPrefix + trailingSpaces;
                            } else {
                                md += innerText;
                            }
                        }
                        else if (tag === 'sup') { md += '<sup>'; traverse(child); md += '</sup>'; }
                        else if (tag === 'sub') { md += '<sub>'; traverse(child); md += '</sub>'; }
                        else if (tag === 'blockquote') {
                            let startLen = md.length;
                            traverse(child);
                            let bqText = md.substring(startLen);
                            md = md.substring(0, startLen);
                            let bqFormatted = bqText.trim().split('\n').map(line => line.trim() === '' ? '>' : '> ' + line).join('\n');
                            md += '\n\n' + bqFormatted + '\n\n';
                        }
                        else if (tag === 'a') { 
                            if (child.hash && /^#F\d+$/i.test(child.hash)) {
                                md += '[^';
                                traverse(child);
                                md += ']';
                            } else {
                                const linksDisabled = articleClone.getAttribute('data-links-disabled') === 'true';
                                if (!linksDisabled) { md += '['; traverse(child); md += `](${child.href})`; }
                                else { traverse(child); }
                            }
                        }
                        else if (tag === 'li') { 
                            const parentTag = child.parentElement ? child.parentElement.tagName.toLowerCase() : '';
                            let prefix = '- ';
                            if (parentTag === 'ol') {
                                let index = 1;
                                let sibling = child.previousElementSibling;
                                while (sibling) {
                                    if (sibling.tagName.toLowerCase() === 'li') index++;
                                    sibling = sibling.previousElementSibling;
                                }
                                
                                if (child.closest('#pep-footnote-layer')) {
                                    prefix = `[^${index}]: `;
                                } else {
                                    prefix = index + '. ';
                                }
                            }
                            let startLen = md.length;
                            traverse(child); 
                            let liText = md.substring(startLen);
                            md = md.substring(0, startLen); 
                            md += prefix + liText.replace(/^\s+/, '') + '\n';
                        }
                        else if (tag === 'ul' || tag === 'ol') { md += '\n'; traverse(child); md += '\n'; }
                        else if (tag === 'button') { continue; } 
                        else { traverse(child); }
                    }
                }
            }
            traverse(node);
            return md.replace(/\n{3,}/g, '\n\n').trim(); 
        }

        function downloadFile(filename, content) {
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; a.style.display = 'none';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    // ==========================================
    // 3. Search Popup 逻辑
    // ==========================================
    function createSearchPopup() {
        const popupHTML = `
            <div id="pep-web-search-popup" data-pep-ui="1">
                <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 16px; color: #333;">Quick Search</h3>
                <form id="pep-web-search-form">
                    <div style="margin-bottom: 10px;">
                        <input type="text" id="author-input" name="author" placeholder="Author" style="width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <input type="number" id="year-input" name="year" placeholder="Year" min="1800" max="2100" style="width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;">
                    </div>
                    <button type="submit" style="width: 100%; padding: 8px; background-color: #C8A2C8; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Search</button>
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

    function injectPopupStyle() {
        if (document.getElementById('pep-search-popup-style')) return;
        const style = document.createElement('style');
        style.id = 'pep-search-popup-style';
        style.innerHTML = `
            #pep-web-search-popup {
                position: fixed; top: 20%; left: 50%; transform: translate(-50%, -20%);
                background: white; padding: 20px; border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 10000000;
                width: 300px; display: none; font-family: system-ui, -apple-system, sans-serif;
            }
            @media print {
                #pep-web-search-popup { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function handleSearchSubmit(event) {
        event.preventDefault();
        const authorInput = document.getElementById('author-input');
        const yearInput = document.getElementById('year-input');
        
        const author = authorInput.value.trim();
        const year = yearInput.value.trim();
        const queryParams = [];

        if (author) queryParams.push(`filters=AND|author:${encodeURIComponent(author)}`);
        if (year) queryParams.push(`filters=AND|year:${encodeURIComponent(year)}`);

        if (queryParams.length > 0) {
            const queryString = queryParams.join('&');
            window.open(`https://pep-web.org/search?${queryString}`, '_blank');
            
            toggleSearchPopup(false);
            authorInput.value = ''; 
            yearInput.value = '';
            authorInput.style.borderColor = '#ccc'; 
            authorInput.placeholder = "Author";
        } else {
            authorInput.placeholder = "AUTHOR REQUIRED";
            authorInput.style.borderColor = 'red';
        }
    }

    function toggleSearchPopup(show) {
        let popup = document.getElementById('pep-web-search-popup');
        if (!popup) {
            createSearchPopup();
            popup = document.getElementById('pep-web-search-popup');
        }
        if (!popup) return;

        const authorInput = document.getElementById('author-input');
        isSearchPopupVisible = show !== undefined ? show : !isSearchPopupVisible;
        popup.style.display = isSearchPopupVisible ? 'block' : 'none';

        if (isSearchPopupVisible && authorInput) {
            authorInput.focus();
            document.addEventListener('keydown', handleEscapeKey);
        } else {
            document.removeEventListener('keydown', handleEscapeKey);
            if (authorInput) {
                authorInput.style.borderColor = '#ccc';
                authorInput.placeholder = "Author";
            }
        }
    }

    function handleEscapeKey(event) {
        if (event.key === 'Escape') toggleSearchPopup(false);
    }

})();
// === END OF FILE ===