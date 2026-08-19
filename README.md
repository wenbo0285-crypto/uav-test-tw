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
