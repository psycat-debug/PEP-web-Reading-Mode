# Changelog

All notable changes to this project will be documented in this file.  
中文说明在每个版本条目下方。

---

## v1.2.1 – 2025-08-23
### English
- Improved paragraph merge logic after page breaks (handles inline runs and `<p class="paracont">` more reliably).
- Added detailed in-code comments for easier maintenance.
- Updated `manifest.json` with author and homepage metadata.
- No new permissions added; all processing remains local.

### 中文
- 改进分页后的段落合并逻辑（更好地处理游离内联节点和 `<p class="paracont">`）。  
- 增加了详细的代码注释，便于后续维护。  
- 更新 `manifest.json`，添加作者与主页信息。  
- 未新增任何权限，所有处理仍然在本地完成。  

---

## v1.2.0 – 2025-08-20
### English
- Added whitelist for `div.biblio` and `div.summaries` sections.  
- Links inside title/author are stripped; links in bibliography and summaries are preserved.

### 中文
- 将 `div.biblio` 和 `div.summaries` 加入白名单。  
- 标题和作者中的链接会被去除；参考文献和摘要中的链接保留。  

---

## v1.1.0 – 2025-08-15
### English
- Removed keyboard shortcut feature; now clicking the extension icon directly triggers reading mode.  
- Simplified manifest and background script accordingly.

### 中文
- 移除了快捷键功能，现在点击扩展图标即可进入阅读模式。  
- 相应简化了 manifest 与 background 脚本。  

---

## v1.0.0 – 2025-08-10
### English
- Initial release.  
- Hide page breaks and stitch across paragraphs when appropriate.  
- Keep only title, author, and body; strip links inside title/author.  

### 中文
- 初始版本发布。  
- 隐藏分页，并在合适时拼接段落。  
- 仅保留标题、作者、正文；标题/作者中的链接被移除。  
