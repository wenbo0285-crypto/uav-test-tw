# Taiwan UAV Exam Practice Site

[![Netlify Status](https://api.netlify.com/api/v1/badges/b6885906-016e-4ff7-ad1d-f8b6f6f5a3c9/deploy-status)](https://app.netlify.com/projects/uav-test-tw/deploys)

Public static website for Taiwan UAV remote pilot exam study, question-bank practice, and drone-license learning resources.

- Live site: https://uav-test.tw
- Netlify fallback: https://uav-test-tw.netlify.app
- Repository: https://github.com/wenbo0285-crypto/uav-test-tw
- Maintainer: [@wenbo0285-crypto](https://github.com/wenbo0285-crypto)
- License: MIT for site code

## What This Project Provides

This project maintains a browser-based study site for Taiwan drone learners preparing for remote pilot exams. It includes:

- ordinary certificate question-bank practice
- professional certificate question-bank practice
- ordinary and professional renewal question banks
- static question-bank pages for search and review
- exam preparation guides
- regulation notes and airspace/safety learning content
- source-reference, privacy, disclaimer, contact, sitemap, and robots pages
- validation tooling for question-bank data and static site health

## Usage And Impact

The project is a public-interest learning site rather than a package library, so GitHub stars are not the main adoption signal. The stronger signal is real public website usage.

Google Analytics snapshot observed on 2026-06-04 for the previous 7 days:

- 505 active users
- 501 new users
- 4,118 views on the main practice page
- 58k events
- 635 Organic Search sessions

These users are mainly finding the site through public search while preparing for Taiwan UAV exam and drone-license study workflows.

## Question-Bank Coverage

The validation script currently checks these data sets:

- `data_normal.js`: 388 ordinary-certificate questions
- `data_pro.js`: 588 professional-certificate questions
- `data_normal_renew.js`: 120 ordinary renewal questions (CAA 115/4/7 version)
- `data_pro_renew.js`: 324 professional renewal questions (CAA 115/4/7 version)

The renewal banks were last cross-checked against the official ODT, PDF, and DOC downloads on 2026-08-20.

## Local Development

This is a static HTML/CSS/JavaScript site. It can be opened directly in a browser, or served locally:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Validation

Run the project validation before publishing changes:

```bash
npm run validate
```

The validation checks:

- core static pages exist
- question-bank source hashes remain unchanged unless an official update is deliberately reviewed
- question-bank JavaScript files can be parsed
- questions include complete option and answer structures
- `sitemap.xml` includes key public pages
- canonical URLs point to `https://uav-test.tw`

Netlify is configured through `netlify.toml` to run this validation before publishing:

```toml
[build]
  command = "npm run validate"
  publish = "."
```

## Regenerating Static Question Banks

After updating question-bank data, regenerate every static bank page:

```powershell
.\tools\generate-static-banks.ps1
```

To regenerate only the two renewal pages:

```powershell
.\tools\generate-static-banks.ps1 -Selection normal-renew,pro-renew
```

## Deployment

The production site is linked to GitHub and deploys from the `main` branch through Netlify. Pushing to `main` triggers a production deploy after validation passes.

## Maintenance Workflow

1. Check whether Taiwan CAA or the remote UAV management system has published updated question banks, rules, or exam process changes.
2. Compare official updates against the local question-bank data.
3. Update question data, source references, and related guide pages.
4. Run `npm run validate`.
5. Update `CHANGELOG.md` when the public site behavior or data changes.
6. Push to `main` and verify the Netlify production deploy.

## Open-Source Maintenance Opportunities

This repository is a good fit for maintainer automation because the hard work is careful review of large public-data changes, not complex infrastructure. Useful automation includes:

- comparing official CAA question-bank updates
- detecting changed answers, duplicate questions, and inconsistent options
- summarizing large data diffs for review
- generating static question-bank pages
- drafting changelog and release notes
- triaging user reports about possible question or regulation discrepancies

## Data Sources

Question-bank and regulation content is organized from public Taiwan UAV exam and aviation-safety resources, including Taiwan CAA public information and remote UAV management references. Official eligibility, exam process, fees, certificate validity, and legal requirements should always be verified against the latest government announcements.

See `sources.html` for the public source-reference page.

## License

Site code is released under the MIT License. Question-bank, regulation, and official-source materials remain subject to their original publishers' terms and public-information rules. This project is for study and exam-preparation support only.

## 0921 reliability update (Batch A)

Requires Node.js 22+ and PowerShell 7 (`pwsh`, for generator checks).

```sh
npm ci
npx playwright install chromium
npm test
npm run preview
```

The local preview is http://127.0.0.1:4173. Browser evidence and the HTML test
report are written to `output/playwright/`. The test suite covers all four banks,
keyboard operation, answer locking, score/progress, failure isolation, themes,
responsive layouts, 200% text sizing, and deliberate static-bank corruption.
Analytics loads only on the production domain in non-automated browsers.

To regenerate static pages reproducibly:

```powershell
pwsh -NoProfile -File tools/generate-static-banks.ps1 -GeneratedAt 2026-09-21
npm run validate
```

Keep the generator's default date and generated pages aligned when intentionally
updating the generation date. Official bank files and expected hashes remain
unchanged. This local copy is not connected to a Git remote and has not been
published.

## 0921 learning update (Batch B, local preview)

`assets/js/learning-ui.js` progressively connects the existing quiz to the pure
`learning-model.js`, guarded `learning-storage.js`, and paged `reading.js`.
The original official data files, baseline hashes and full static bank pages
are unchanged. This batch does not implement C/D, change analytics configuration,
or publish the site.

- `uav:v1:learning` is one atomic, versioned localStorage envelope: one active
  attempt, at most 50 historical attempts, and a mistake index. Keeping these
  together prevents an answer being saved without its corresponding mistake.
  Records contain bank identity, question IDs and user responses, not official
  question text. Scores are derived from the matching bank version.
- Web Locks serializes writes. A storage snapshot and `storage` events reject
  stale tabs; the learner must load the latest record. Missing/denied locks,
  storage permission failures or quota failures fall back to memory with a warning.
  Corrupt raw data is retained until explicit reset/import and can be exported.
- Imports must be schema version 1, at most 2 MiB, with valid bank identities,
  ordered unique question IDs, valid choices, timestamps and counters. Versions
  that do not match are retained but not replayed against the current answers.
- Answer confirmation, advancing and completion save independently of unload.
  Resume restores submitted radio values and never repeats start/answer/complete
  events. Reviews use separate `review_*` events; analytics remains disabled locally.
- Active time accrues while the quiz is visible and there was input in the past
  60 seconds; it is an approximate engagement measure, saved at quiz actions.
- Mistakes are keyed by bank + version + hash + question ID. Correct retries do
  not delete them or silently change the learner's pending/mastered choice.
- Reading searches original IDs, question text and options, combines chapter
  filters, keeps official order, renders 40 per page and can hide answers.
  `?bank=normal&mode=reading&q=Q123` is a validated deep link. Reading position
  and filters use `uav:v1:reading`; they are not included in quiz backup exports.
  “Clear all learning data” clears both keys' learning content, preserving theme.

Run `npm test` for the original regression suite plus learning/storage/import,
multi-tab, reading and accessibility checks. Screenshots can be reproduced with
`node tools/capture-learning.mjs after`; optional before captures accept a source
directory as the third argument. Use HTTP preview (`npm run preview`), not a
`file://` URL, for JavaScript modules and safe cross-tab storage.

## 0921 navigation and measurement update (Batch C, local preview)

- `assets/js/navigation.js` adds an accessible disclosure to home, guide, friend
  and static-bank headers at 1150 px and below. Escape closes it and returns
  focus; the friend link remains directly visible. Home's long guide uses native
  details/summary without removing its text or changing public URLs.
- `bank-loader.js` loads original, unmodified bank scripts only on demand,
  caches in-flight/successful loads, and retries network failures. A navigation
  generation prevents stale requests from changing the selected bank. The B
  storage schema is unchanged; resume, reviews, imports and history request only
  the banks they need. Unavailable history banks do not prevent exporting data.
- `analytics.js` is included once on every content document. It sends one explicit
  document pageview (`send_page_view:false`), uses custom events for app screens,
  whitelists parameters, and includes attempt ID, bank version, mode and active
  duration. No question text or complete external-link URL/text is sent by custom
  events. Only actual friend-page external clicks count as `friend_link_click`.
  Local and automated browsers record at most 200 diagnostic events in memory
  and never load the production GA tag. Missing tracking files do not block quizzes.

Before production release, verify the GA web stream has automatic history
pageviews disabled; `send_page_view:false` alone does not disable that Enhanced
Measurement setting. Also review automatic outbound, site-search and form
measurement so they do not duplicate the explicit events or collect URL/input
data outside this whitelist. These property-side settings and real reception
have **not** been changed or verified by local tests. Do not register attempt_id
as a high-cardinality report dimension. No deployment was performed.

Google documentation: https://developers.google.com/analytics/devguides/collection/ga4/views

`node tools/measure-loading.mjs <pre-C-source-folder>` produces three-run mobile
network laboratory measurements under `output/playwright/batch-c/`. These are
load/readiness timings, not field Core Web Vitals. Capture comparison screenshots:

```sh
node tools/capture-learning.mjs before <pre-C-source-folder> output/playwright/batch-c-before
node tools/capture-learning.mjs after . output/playwright/batch-c-after
```
## 0921 內容與發布整理（D 批，本機驗證）

- 16 個指南頁標明本站編輯、2026-09-21 編輯檢查日期、官方資料入口與對應題庫閱讀連結。編輯日期不等於題庫或現行法規全面重新查核。
- 普通／專業操作權限摘要依 113 年 11 月 14 日修正公報整理；交通部條文全文本次連線逾時，完整現行法規複核仍待完成。
- 四份題庫、基準驗證器、A～C 的學習與追蹤邏輯、紅綠配色不變。
- `tools/public-files.json` 是明確發布白名單。新增資產或公開頁時須加入清單；內容頁同步更新 canonical 與 sitemap。不要把內部文件加入清單。
- `npm run build` 驗證來源，清空本專案的 `dist/`，逐檔原樣複製，再驗證輸出。不得把發布目錄改回專案根目錄。
- `npm test` 先建置，再以專用 4175 埠測試 **dist**（不重用其他 Preview）。包含原有完整回歸、靜態產生器與發布檔案／網址檢查。
- `npm run preview` 先執行相同建置，再於 http://127.0.0.1:4174 提供 dist。舊 4173 是先前來源目錄預覽，請使用 4174 看最終結果。
- Preview 模擬靜態目錄 index、無副檔名 HTML 與 favicon；保留 `.html` canonical，不新增全站強制轉址。未知頁回傳 HTTP 404，404 頁不索引。實際 Netlify CDN 行為仍需經核准的遠端 Preview 驗證。
- `npm run release` 執行相同建置、安裝 Chromium、跑互動與發布回歸；僅略過需要 PowerShell 的產生器測試，該測試仍由 `npm test` 和 GitHub CI 完整執行。任何錯誤都以非零結束，阻擋 Netlify 發布。
- Netlify 所有 context 使用 `npm run release`、`publish = "dist"`。CI 執行完整 `npm test`，僅成功時上傳 verified-dist；沒有新增自動推送或發布步驟。
- Netlify build 主機必須支援 Chromium 系統函式庫與瀏覽器下載；尚未遠端實測。若依賴缺失應修正建置環境，不可跳過測試以發布。

本機檢查不代表正式 GA 後台、搜尋收錄或真實 CDN 已驗證。發布前應先核對既有 GA Enhanced Measurement 設定、核准遠端 Preview、記錄通過的 Git commit／dist 檔案雜湊與 Netlify deploy ID，再由使用者決定是否發布。回滾時選已通過驗證的上一個 deploy；不刪除使用者本機學習資料。

## SEO／GEO 0922 與觀察期

`tools/seo.mjs` 在建置時補入靜態 OG／分享資訊、WebSite／WebPage／Article／BreadcrumbList。結構化資料取自可見標題、日期與來源，不捏造個人作者、首次發布日、評分或官方身分。HTML 會被建置增補，其他資產仍逐位元組複製；官方題庫與靜態題目的一致性仍由既有驗證器保護。

`tools/generate-static-banks.ps1` 為題號標記增加 Q1 等 id；公開題庫頁可用 #Q123 分享，不改題目或答案。`assets/social-card.png` 是本機以既有航空向量資產及品牌色產生的 1200×630 分享卡。

新增 SEO 測試涵蓋 metadata 與可見內容一致、canonical、1420 個唯一原題號錨點及停用 JavaScript 後的定位／麵包屑。最新報表匯出與 deploy ID 必須保存到專案外的私人 output 資料夾，不能列入發布白名單或提交公開 GitHub。發布日期仍以實際部署紀錄為準。
