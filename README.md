# Clinical Evidence Explorer

A browser-based clinical evidence discovery and systematic-review workflow prototype, owned by Dr Mohammed Elbeltagi. It retrieves current records from PubMed and ClinicalTrials.gov and accepts Scopus CSV exports. Search, screening, and extraction are not a substitute for source verification or validated review software.

## Run locally

1. Install Node.js 18 or newer.
2. On Windows, double-click `start-clinical-evidence.cmd`. Or run `node server.mjs` in this folder.
3. Open `http://127.0.0.1:4173`. Stop the server with `Ctrl+C` (or close the launcher window).

The app uses plain HTML, CSS, JavaScript, and Node's built-in HTTP module; there is no package install or build step. Source requests are made directly from the browser. Search and screening data are stored only in that browser's local storage. Export a review JSON or extraction CSV to keep a copy elsewhere.

## Research sources

- **PubMed:** Searches NCBI E-utilities, then loads citation summaries and abstracts for the current page. Use **Load next source page** to continue retrieving results.
- **ClinicalTrials.gov:** Searches the v2 API and includes structured registry age, study status, interventions, outcomes, and references when provided.
- **Scopus:** Import a CSV exported from a Scopus account. This is a local file import, not a Scopus API integration; no Scopus credentials are requested or stored.

Searches use entered PICO concepts, not semantic ranking. The app does not search full text, verify eligibility, link every publication to a trial, or extract study outcomes automatically. PubMed age eligibility is not structured, and records with uncertain age or study details are marked for manual review. API result totals can exceed records loaded into the browser; only loaded pages are frozen into a review, and source totals are shown separately.

## Included workflow

- Editable PICO query with age and exact-intervention controls.
- Live PubMed and ClinicalTrials.gov retrieval, page-by-page loading, and deduplication by PMID, NCT ID, DOI, and Scopus EID.
- Scopus CSV import with record identifiers, abstract, year, and source links when included in the export.
- Manual-review flags for age and source details that need verification.
- A frozen query and record snapshot for a separate, local PRISMA-style workflow.
- Two local reviewer decisions, disagreement/consensus states, activity history, and manual quantitative extraction with provenance fields.
- JSON review export and CSV extraction export.

## Limitations

The workflow is stored in one browser and is not shared across reviewers or devices. It has no protocol registration, full-text retrieval, authentication, server-side database, multi-user audit trail, automatic extraction, meta-analysis, clinical recommendations, or PRISMA compliance validation. The PRISMA-style counts are working counts for loaded/selected records and local decisions, not an independently validated flow diagram. Verify all records, eligibility, and extracted values against the original sources.
