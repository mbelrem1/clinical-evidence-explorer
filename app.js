"use strict";

const STORAGE_KEY = "clinical-evidence-explorer.v2";
const SOURCE_PAGE_SIZE = 50;
const PUBMED_API = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const CLINICAL_TRIALS_API = "https://clinicaltrials.gov/api/v2/studies";
const DEFAULT_QUERY = {
  population: "Chronic heart failure",
  intervention: "Exercise",
  comparator: "Usual care",
  outcome: "Hospitalization or 6-minute walk distance",
  age: "65",
  ageMinimum: null,
  ageMaximum: null,
  strictAge: false,
  exactIntervention: false
};

const AGE_GROUPS = Object.freeze({
  all: { minimum: null, maximum: null, label: "all ages (including children)" },
  "0-17": { minimum: 0, maximum: 17, label: "children and adolescents (0–17 years)" },
  "18": { minimum: 18, maximum: null, label: "adults (18 years and older)" },
  "50": { minimum: 50, maximum: null, label: "50 years and older" },
  "60": { minimum: 60, maximum: null, label: "60 years and older" },
  "65": { minimum: 65, maximum: null, label: "65 years and older" },
  "70": { minimum: 70, maximum: null, label: "70 years and older" }
});

const DEMO_RECORDS = [
  {
    id: "D-001",
    title: "Home-based exercise rehabilitation for adults with chronic heart failure",
    condition: "Chronic heart failure",
    population: "Adults aged 65 years and older",
    minAge: 65,
    maxAge: 99,
    ageLabel: "65+ years",
    intervention: "Home-based exercise rehabilitation",
    comparator: "Usual care",
    outcome: "All-cause hospitalization at 12 months",
    design: "Parallel-group randomized trial",
    year: 2022,
    sampleSize: 138,
    publicationStatus: "Published record (demo)",
    pmid: "PMID-DEMO-001",
    nct: "NCT-DEMO-001",
    manualReason: "",
    note: "Illustrative study record. Trial and publication identifiers are placeholders."
  },
  {
    id: "D-002",
    title: "Telephone-supported exercise after heart failure discharge",
    condition: "Chronic heart failure",
    population: "Adults aged 60 to 80 years",
    minAge: 60,
    maxAge: 80,
    ageLabel: "60–80 years",
    intervention: "Exercise rehabilitation with telephone coaching",
    comparator: "Usual care",
    outcome: "All-cause hospitalization and 6-minute walk distance",
    design: "Pragmatic randomized trial",
    year: 2021,
    sampleSize: 204,
    publicationStatus: "Publication linked (demo)",
    pmid: "PMID-DEMO-002",
    nct: "NCT-DEMO-002",
    manualReason: "Mixed age range overlaps the requested group; verify subgroup eligibility.",
    note: "A mixed-age sample is shown as a borderline case for manual eligibility review."
  },
  {
    id: "D-003",
    title: "Supervised aerobic training in older adults with heart failure",
    condition: "Chronic heart failure",
    population: "Adults aged 70 years and older",
    minAge: 70,
    maxAge: 99,
    ageLabel: "70+ years",
    intervention: "Supervised aerobic exercise",
    comparator: "Usual care",
    outcome: "6-minute walk distance at 24 weeks",
    design: "Randomized controlled trial",
    year: 2020,
    sampleSize: 92,
    publicationStatus: "Publication linked (demo)",
    pmid: "PMID-DEMO-003",
    nct: "NCT-DEMO-003",
    manualReason: "",
    note: "Outcome and bibliographic details are synthetic examples for the prototype."
  },
  {
    id: "D-004",
    title: "Personalized home activity support in chronic heart failure",
    condition: "Chronic heart failure",
    population: "Adults aged 65 years and older",
    minAge: 65,
    maxAge: 99,
    ageLabel: "65+ years",
    intervention: "Home exercise and activity coaching",
    comparator: "Usual care",
    outcome: "Heart-failure hospitalization at 12 months",
    design: "Interventional registry record",
    year: 2023,
    sampleSize: 160,
    publicationStatus: "Completed · results not posted (demo)",
    pmid: "",
    nct: "NCT-DEMO-004",
    manualReason: "Completed registry record has no linked publication in this demo set.",
    note: "Unpublished-result state is illustrative; no live registry data is queried."
  },
  {
    id: "D-005",
    title: "Mixed exercise program for adults with chronic heart failure",
    condition: "Chronic heart failure",
    population: "Adults aged 55 to 75 years",
    minAge: 55,
    maxAge: 75,
    ageLabel: "55–75 years",
    intervention: "Mixed exercise rehabilitation",
    comparator: "Usual care",
    outcome: "All-cause hospitalization and walking capacity",
    design: "Controlled clinical study",
    year: 2019,
    sampleSize: 116,
    publicationStatus: "Publication linked (demo)",
    pmid: "PMID-DEMO-005",
    nct: "NCT-DEMO-005",
    manualReason: "Mixed age range; age-specific results are not supplied in the demo record.",
    note: "Reviewers would need to verify whether an eligible older-adult subgroup is reported."
  }
];

const DEFAULT_EXTRACTION = {
  outcome: "All-cause hospitalization",
  timepoint: "12 months",
  measure: "Risk ratio",
  value: "0.68",
  ci: "0.39 to 1.18",
  sampleSize: "68 / 70",
  units: "Participants with event",
  sourceText: "Synthetic excerpt: the intervention and comparator groups are summarized for demonstration only. This is not copied from a publication.",
  locator: "Page 7, Table 2 (synthetic)",
  reviewer: "Reviewer A",
  updatedAt: ""
};

const state = {
  query: { ...DEFAULT_QUERY },
  searchRecords: [],
  recordIds: [],
  dataMode: "demo",
  searchMeta: null,
  searchBusy: false,
  manualOnly: false,
  expandedRecordId: "",
  mode: "scoping",
  view: "search",
  review: null,
  extraction: {},
  storageErrorShown: false
};

const elements = {
  form: document.getElementById("pico-form"),
  population: document.getElementById("pico-population"),
  intervention: document.getElementById("pico-intervention"),
  comparator: document.getElementById("pico-comparator"),
  outcome: document.getElementById("pico-outcome"),
  age: document.getElementById("age-filter"),
  ageRangeFields: document.getElementById("age-range-fields"),
  ageMinimum: document.getElementById("age-minimum"),
  ageMaximum: document.getElementById("age-maximum"),
  strictAge: document.getElementById("strict-age"),
  exactIntervention: document.getElementById("exact-intervention"),
  sourcePubMed: document.getElementById("source-pubmed"),
  sourceTrials: document.getElementById("source-trials"),
  scopusImportButton: document.getElementById("import-scopus-csv"),
  searchButton: document.getElementById("search-live"),
  scopusImport: document.getElementById("scopus-import"),
  loadDemoButton: document.getElementById("load-demo-data"),
  loadMoreRow: document.getElementById("load-more-row"),
  loadMoreButton: document.getElementById("load-more-results"),
  loadMoreStatus: document.getElementById("load-more-status"),
  studyList: document.getElementById("study-list"),
  resultCount: document.getElementById("results-count"),
  resultsSummary: document.getElementById("results-summary"),
  manualFilter: document.getElementById("manual-filter"),
  manualCount: document.getElementById("manual-filter-count"),
  emptyResults: document.getElementById("empty-results"),
  topbarCurrent: document.getElementById("topbar-current"),
  modeDescription: document.getElementById("mode-description"),
  modeScoping: document.getElementById("mode-scoping"),
  modePrisma: document.getElementById("mode-prisma"),
  prismaTabStatus: document.getElementById("prisma-tab-status"),
  freezeButton: document.getElementById("freeze-review"),
  screeningList: document.getElementById("screening-list"),
  screeningQueueCount: document.getElementById("screening-queue-count"),
  flowCounts: document.getElementById("flow-counts"),
  frozenDate: document.getElementById("frozen-date"),
  frozenSummary: document.getElementById("frozen-summary"),
  auditList: document.getElementById("audit-list"),
  extractionContext: document.getElementById("extraction-context"),
  extractionForm: document.getElementById("extraction-form"),
  extractionSaved: document.getElementById("extraction-saved"),
  toastRegion: document.getElementById("toast-region"),
  aboutDialog: document.getElementById("about-dialog")
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function normalized(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function phraseAlternatives(value) {
  return String(value ?? "")
    .split(/\s+\bor\b\s+/i)
    .map(normalized)
    .filter(Boolean);
}

function fieldMatches(query, candidates, exact = false) {
  const search = normalized(query);
  if (!search) return true;
  const source = candidates.map(normalized);
  if (exact) return source.some((candidate) => candidate === search);

  return phraseAlternatives(query).some((phrase) => {
    const words = phrase.split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    return source.some((candidate) => words.every((word) => candidate.includes(word)));
  });
}

function currentRecords() {
  return state.dataMode === "demo" ? DEMO_RECORDS : state.searchRecords;
}

function selectedAgeGroup(query) {
  if (query.age !== "custom") return AGE_GROUPS[query.age] ?? AGE_GROUPS.all;

  const { ageMinimum: minimum, ageMaximum: maximum } = query;
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum)
    || minimum < 0 || maximum > 120 || minimum > maximum) {
    return { minimum: null, maximum: null, label: "custom age range" };
  }
  return { minimum, maximum, label: `${minimum}–${maximum} years` };
}

function matchesAgeGroup(record, query) {
  const { minimum, maximum } = selectedAgeGroup(query);
  if (query.age === "custom" && (minimum === null || maximum === null)) return false;
  if (minimum === null && maximum === null) return true;

  const minKnown = Number.isFinite(record.minAge);
  const maxKnown = Number.isFinite(record.maxAge);
  if (minimum !== null && maxKnown && record.maxAge < minimum) return false;
  if (maximum !== null && minKnown && record.minAge > maximum) return false;
  if (query.strictAge) {
    if (minimum !== null && minKnown && record.minAge < minimum) return false;
    if (maximum !== null && maxKnown && record.maxAge > maximum) return false;
  }
  return true;
}

function ageGroupNeedsReview(record, query) {
  const { minimum, maximum } = selectedAgeGroup(query);
  if (minimum === null && maximum === null) return false;
  if (!Number.isFinite(record.minAge) || !Number.isFinite(record.maxAge)) return true;
  return (minimum !== null && record.minAge < minimum)
    || (maximum !== null && record.maxAge > maximum);
}

function matchesRecord(record, query) {
  if (!matchesAgeGroup(record, query)) return false;
  if (record.sourceType && record.sourceType !== "demo") {
    return true;
  }

  return fieldMatches(query.population, [record.condition, record.population, record.title])
    && fieldMatches(query.intervention, [record.intervention], query.exactIntervention)
    && fieldMatches(query.comparator, [record.comparator])
    && fieldMatches(query.outcome, [record.outcome]);
}

function getVisibleRecords() {
  const recordSet = new Set(state.recordIds);
  return currentRecords().filter((record) => recordSet.has(record.id))
    .filter((record) => !state.manualOnly || isManualReview(record, state.query));
}

function isManualReview(record, query = state.query) {
  return Boolean(record.manualReason || ageGroupNeedsReview(record, query));
}

function readForm() {
  return {
    population: elements.population.value.trim(),
    intervention: elements.intervention.value.trim(),
    comparator: elements.comparator.value.trim(),
    outcome: elements.outcome.value.trim(),
    age: elements.age.value,
    ageMinimum: elements.ageMinimum.value === "" ? null : Number(elements.ageMinimum.value),
    ageMaximum: elements.ageMaximum.value === "" ? null : Number(elements.ageMaximum.value),
    strictAge: elements.strictAge.checked,
    exactIntervention: elements.exactIntervention.checked
  };
}

function updateAgeRangeFields() {
  const customRange = elements.age.value === "custom";
  elements.ageRangeFields.hidden = !customRange;
  elements.ageMinimum.required = customRange;
  elements.ageMaximum.required = customRange;
  const hasBothBounds = elements.ageMinimum.value !== "" && elements.ageMaximum.value !== "";
  elements.ageMaximum.setCustomValidity(
    customRange && hasBothBounds && Number(elements.ageMaximum.value) < Number(elements.ageMinimum.value)
      ? "To age must be equal to or greater than From age."
      : ""
  );
}

function updateAgeSelection() {
  updateAgeRangeFields();
  if (state.review) return;
  state.query = readForm();
  state.recordIds = currentRecords()
    .filter((record) => matchesRecord(record, state.query))
    .map((record) => record.id);
  persistState();
  renderSearch();
}

function fillForm(query) {
  elements.population.value = query.population ?? "";
  elements.intervention.value = query.intervention ?? "";
  elements.comparator.value = query.comparator ?? "";
  elements.outcome.value = query.outcome ?? "";
  elements.age.value = query.age ?? "all";
  elements.ageMinimum.value = query.ageMinimum ?? "";
  elements.ageMaximum.value = query.ageMaximum ?? "";
  updateAgeRangeFields();
  elements.strictAge.checked = Boolean(query.strictAge);
  elements.exactIntervention.checked = Boolean(query.exactIntervention);
}

function readStoredState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") throw new Error("Stored workspace data is not an object.");
    return parsed;
  } catch (error) {
    console.error("Could not read the saved local workspace.", error);
    window.addEventListener("load", () => toast("Saved workspace data could not be read. A fresh demo view is open."));
    return null;
  }
}

function persistState() {
  const payload = {
    query: state.query,
    searchRecords: state.searchRecords,
    recordIds: state.recordIds,
    dataMode: state.dataMode,
    searchMeta: state.searchMeta,
    manualOnly: state.manualOnly,
    mode: state.mode,
    view: state.view,
    review: state.review,
    extraction: state.extraction
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("Could not save the local workspace.", error);
    if (!state.storageErrorShown) {
      state.storageErrorShown = true;
      toast("This browser could not save changes locally. Export your review JSON before leaving.");
    }
  }
}

function restoreState() {
  const saved = readStoredState();
  if (!saved) {
    state.query = { ...DEFAULT_QUERY };
    state.recordIds = DEMO_RECORDS.filter((record) => matchesRecord(record, state.query)).map((record) => record.id);
    return;
  }

  state.query = { ...DEFAULT_QUERY, ...(saved.query ?? {}) };
  state.searchRecords = Array.isArray(saved.searchRecords) ? saved.searchRecords : [];
  state.dataMode = ["demo", "live", "scopus", "mixed"].includes(saved.dataMode) ? saved.dataMode : "demo";
  state.searchMeta = saved.searchMeta && typeof saved.searchMeta === "object" ? saved.searchMeta : null;
  state.recordIds = Array.isArray(saved.recordIds)
    ? saved.recordIds.filter((id) => currentRecords().some((record) => record.id === id))
    : currentRecords().filter((record) => matchesRecord(record, state.query)).map((record) => record.id);
  if (!state.recordIds.length && !saved.recordIds) {
    state.recordIds = currentRecords().filter((record) => matchesRecord(record, state.query)).map((record) => record.id);
  }
  state.manualOnly = Boolean(saved.manualOnly);
  state.review = saved.review && Array.isArray(saved.review.recordIds)
    ? saved.review
    : null;
  state.extraction = saved.extraction && typeof saved.extraction === "object" ? saved.extraction : {};
  state.mode = state.review && saved.mode === "prisma" ? "prisma" : "scoping";
  state.view = state.mode === "prisma" && ["screening", "extraction"].includes(saved.view) ? saved.view : "search";
}

function toast(message) {
  const item = document.createElement("div");
  item.className = "toast";
  item.setAttribute("role", "status");
  item.textContent = message;
  elements.toastRegion.append(item);
  window.setTimeout(() => item.remove(), 4200);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function sourceSearchUrl(source, title) {
  const query = encodeURIComponent(title);
  return source === "pubmed"
    ? `https://pubmed.ncbi.nlm.nih.gov/?term=${query}`
    : `https://clinicaltrials.gov/search?term=${query}`;
}

function pubmedGroup(value) {
  const terms = String(value ?? "")
    .split(/\s+\bor\b\s+/i)
    .map((term) => term.trim().replace(/"/g, ""))
    .filter(Boolean);
  return terms.length
    ? `(${terms.map((term) => `"${term}"[Title/Abstract]`).join(" OR ")})`
    : "";
}

function buildPubMedQuery(query) {
  return [query.population, query.intervention, query.comparator, query.outcome]
    .map(pubmedGroup)
    .filter(Boolean)
    .join(" AND ");
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
  return response.json();
}

async function fetchText(url, accept) {
  const response = await fetch(url, {
    headers: { Accept: accept },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
  return response.text();
}

function pubmedAbstractMap(xml) {
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  if (documentXml.querySelector("parsererror")) throw new Error("PubMed returned invalid XML.");
  const abstracts = new Map();
  documentXml.querySelectorAll("PubmedArticle").forEach((article) => {
    const pmid = article.querySelector("PMID")?.textContent?.trim();
    if (!pmid) return;
    const text = [...article.querySelectorAll("AbstractText")]
      .map((part) => part.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    const nctIds = [...article.querySelectorAll("DataBank")]
      .filter((bank) => /clinicaltrials\.gov/i.test(bank.querySelector("DataBankName")?.textContent ?? ""))
      .flatMap((bank) => [...bank.querySelectorAll("AccessionNumber")].map((node) => node.textContent?.trim()))
      .filter((value) => /^NCT\d{8}$/i.test(value ?? ""));
    const abstractNct = text.match(/\bNCT\d{8}\b/i)?.[0];
    abstracts.set(pmid, { text, nct: nctIds[0] ?? abstractNct ?? "" });
  });
  return abstracts;
}

function pubmedRecord(summary, abstractData = {}) {
  const pmid = String(summary.uid ?? "");
  const doi = summary.articleids?.find((item) => item.idtype === "doi")?.value ?? "";
  const year = String(summary.pubdate ?? "").match(/\b(?:19|20)\d{2}\b/)?.[0] ?? "";
  const types = Array.isArray(summary.pubtype) ? summary.pubtype.join(", ") : "PubMed citation";
  return {
    id: `PMID-${pmid}`,
    sourceType: "pubmed",
    sources: ["PubMed"],
    title: summary.title?.replace(/\.$/, "") || "Untitled PubMed record",
    condition: "Review abstract/full text",
    population: "Age and eligibility not structured in PubMed citation",
    minAge: null,
    maxAge: null,
    ageLabel: "Verify in abstract/full text",
    intervention: "Review abstract/full text",
    comparator: "Review abstract/full text",
    outcome: "Review abstract/full text",
    design: types,
    year,
    sampleSize: "Not reported in citation",
    publicationStatus: "PubMed publication record",
    pmid,
    nct: abstractData.nct ?? "",
    doi,
    manualReason: "Verify study design, population, age, intervention, and outcomes against the source.",
    note: abstractData.text || "No abstract is available in this PubMed record.",
    abstract: abstractData.text ?? "",
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`
  };
}

async function fetchPubMedPage(query, retstart = 0) {
  const term = buildPubMedQuery(query);
  const searchUrl = new URL(`${PUBMED_API}/esearch.fcgi`);
  searchUrl.search = new URLSearchParams({
    db: "pubmed",
    term,
    retmode: "json",
    retmax: String(SOURCE_PAGE_SIZE),
    retstart: String(retstart),
    sort: "relevance"
  });
  const search = await fetchJson(searchUrl);
  const result = search.esearchresult;
  const ids = result.idlist ?? [];
  if (!ids.length) {
    return {
      records: [],
      total: Number(result.count ?? 0),
      nextStart: retstart,
      query: result.querytranslation ?? term,
      errors: []
    };
  }

  const detailsUrls = [
    new URL(`${PUBMED_API}/esummary.fcgi`),
    new URL(`${PUBMED_API}/efetch.fcgi`)
  ];
  detailsUrls[0].search = new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "json" });
  detailsUrls[1].search = new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "xml" });
  const [summaryResult, abstractResult] = await Promise.allSettled([
    fetchJson(detailsUrls[0]),
    fetchText(detailsUrls[1], "application/xml")
  ]);
  if (summaryResult.status === "rejected") throw summaryResult.reason;

  const summaryData = summaryResult.value.result;
  const abstracts = abstractResult.status === "fulfilled" ? pubmedAbstractMap(abstractResult.value) : new Map();
  const records = (summaryData.uids ?? [])
    .map((id) => summaryData[id])
    .filter(Boolean)
    .map((summary) => pubmedRecord(summary, abstracts.get(String(summary.uid)) ?? {}));
  const errors = abstractResult.status === "rejected" ? [`Abstract retrieval failed: ${abstractResult.reason.message}`] : [];
  return {
    records,
    total: Number(result.count ?? records.length),
    nextStart: retstart + ids.length,
    query: result.querytranslation ?? term,
    errors
  };
}

function parseAge(value) {
  const match = String(value ?? "").match(/\b(\d+)\s*Years?\b/i);
  return match ? Number(match[1]) : null;
}

function trialRecord(study) {
  const protocol = study.protocolSection ?? {};
  const identification = protocol.identificationModule ?? {};
  const status = protocol.statusModule ?? {};
  const design = protocol.designModule ?? {};
  const eligibility = protocol.eligibilityModule ?? {};
  const interventions = protocol.armsInterventionsModule?.interventions ?? [];
  const outcomes = protocol.outcomesModule ?? {};
  const minAge = parseAge(eligibility.minimumAge);
  const maxAge = parseAge(eligibility.maximumAge);
  const completed = status.overallStatus === "COMPLETED";
  const hasResults = Boolean(protocol.resultsSection);
  const references = protocol.referencesModule?.references ?? [];
  const resultPmids = references.filter((item) => item.type === "RESULT").map((item) => item.pmid).filter(Boolean);
  const primaryOutcomes = outcomes.primaryOutcomes ?? [];
  const secondaryOutcomes = outcomes.secondaryOutcomes ?? [];
  const allOutcomes = [...primaryOutcomes, ...secondaryOutcomes]
    .map((item) => item.measure)
    .filter(Boolean);
  const studyType = design.studyType ?? "Clinical study";
  const year = String(status.completionDateStruct?.date ?? status.startDateStruct?.date ?? "").match(/\b(?:19|20)\d{2}\b/)?.[0] ?? "";
  const ageLabel = Number.isFinite(minAge) && Number.isFinite(maxAge)
    ? `${minAge}–${maxAge} years`
    : Number.isFinite(minAge) ? `${minAge}+ years` : "Age not reported";

  return {
    id: identification.nctId ?? "",
    sourceType: "clinicaltrials",
    sources: ["ClinicalTrials.gov"],
    title: identification.briefTitle ?? identification.officialTitle ?? "Untitled trial record",
    condition: (protocol.conditionsModule?.conditions ?? []).join(", ") || "Condition not listed",
    population: eligibility.studyPopulation ?? "Review eligibility criteria",
    minAge,
    maxAge,
    ageLabel,
    intervention: interventions.map((item) => item.name).filter(Boolean).join("; ") || "Intervention not listed",
    comparator: (protocol.armsInterventionsModule?.armGroups ?? []).map((item) => item.label).filter(Boolean).join("; ") || "Comparator not listed",
    outcome: allOutcomes.join("; ") || "Outcomes not listed",
    design: [studyType, design.phases?.join(", ")].filter(Boolean).join(" · "),
    year,
    sampleSize: design.enrollmentInfo?.count ?? "Not reported",
    publicationStatus: completed && !hasResults ? "Completed · results not posted" : status.overallStatus ?? "Status not reported",
    pmid: resultPmids[0] ?? "",
    relatedPmids: [...new Set(references.map((item) => item.pmid).filter(Boolean))],
    nct: identification.nctId ?? "",
    doi: "",
    manualReason: Number.isFinite(minAge) && Number.isFinite(maxAge)
      ? ""
      : "Structured age eligibility is incomplete; verify the registry record.",
    note: protocol.descriptionModule?.briefSummary ?? eligibility.eligibilityCriteria ?? "No study summary is available.",
    abstract: protocol.descriptionModule?.briefSummary ?? "",
    sourceUrl: `https://clinicaltrials.gov/study/${encodeURIComponent(identification.nctId ?? "")}`
  };
}

async function fetchClinicalTrialsPage(query, pageToken = "") {
  const url = new URL(CLINICAL_TRIALS_API);
  const params = new URLSearchParams({ format: "json", pageSize: String(SOURCE_PAGE_SIZE), countTotal: "true" });
  if (query.population) params.set("query.cond", query.population);
  if (query.intervention) params.set("query.intr", query.intervention);
  if (query.outcome) params.set("query.outc", query.outcome);
  if (query.comparator) params.set("query.term", query.comparator);
  if (pageToken) params.set("pageToken", pageToken);
  url.search = params;
  const result = await fetchJson(url);
  return {
    records: (result.studies ?? []).map(trialRecord),
    total: Number(result.totalCount ?? (result.studies ?? []).length),
    nextPageToken: result.nextPageToken ?? "",
    query: Object.fromEntries(params.entries()),
    errors: []
  };
}

function mergeRecords(existing, incoming) {
  const merged = [...existing];
  incoming.forEach((record) => {
    const matchIndex = merged.findIndex((item) => (
      (record.pmid && (item.pmid === record.pmid || item.relatedPmids?.includes(record.pmid)))
      || (item.pmid && record.relatedPmids?.includes(item.pmid))
      || (record.nct && (item.nct === record.nct || item.linkedNct === record.nct))
      || (record.eid && item.eid === record.eid)
      || (record.doi && item.doi && item.doi.toLowerCase() === record.doi.toLowerCase())
    ));
    if (matchIndex < 0) {
      merged.push(record);
      return;
    }

    const current = merged[matchIndex];
    const registry = [current, record].find((item) => item.sourceType === "clinicaltrials");
    const manualReasons = [...new Set([current.manualReason, record.manualReason].filter(Boolean))];
    merged[matchIndex] = {
      ...current,
      sources: [...new Set([...(current.sources ?? []), ...(record.sources ?? [])])],
      pmid: current.pmid || record.pmid,
      nct: current.nct || record.nct,
      relatedPmids: [...new Set([...(current.relatedPmids ?? []), ...(record.relatedPmids ?? [])])],
      doi: current.doi || record.doi,
      eid: current.eid || record.eid,
      ...(registry ? {
        condition: registry.condition,
        population: registry.population,
        minAge: registry.minAge,
        maxAge: registry.maxAge,
        ageLabel: registry.ageLabel,
        intervention: registry.intervention,
        comparator: registry.comparator,
        outcome: registry.outcome,
        design: registry.design,
        year: registry.year,
        sampleSize: registry.sampleSize,
        publicationStatus: registry.publicationStatus
      } : {}),
      manualReason: manualReasons.join(" "),
      linkedRecordTitle: current.title !== record.title ? record.title : current.linkedRecordTitle,
      note: [current.note, record.note].filter(Boolean).join("\n\n"),
      abstract: current.abstract || record.abstract || ""
    };
  });
  return merged;
}

function hasMoreResults() {
  const pubmedMore = state.searchMeta?.pubmed && state.searchMeta.pubmed.nextStart < state.searchMeta.pubmed.total;
  const trialsMore = state.searchMeta?.trials && Boolean(state.searchMeta.trials.nextPageToken);
  return Boolean(pubmedMore || trialsMore);
}

function sourceMetadata(result, previous = null) {
  return {
    total: result.total,
    loaded: (previous?.loaded ?? 0) + result.records.length,
    nextStart: result.nextStart ?? previous?.nextStart ?? 0,
    nextPageToken: result.nextPageToken ?? "",
    query: result.query ?? previous?.query ?? "",
    errors: [...(previous?.errors ?? []), ...(result.errors ?? [])]
  };
}

async function searchLiveSources() {
  state.query = readForm();
  state.manualOnly = false;
  state.expandedRecordId = "";
  const selected = {
    pubmed: elements.sourcePubMed.checked,
    trials: elements.sourceTrials.checked
  };
  if (!selected.pubmed && !selected.trials) {
    toast("Select PubMed, ClinicalTrials.gov, or both before searching.");
    return;
  }

  state.searchBusy = true;
  state.searchRecords = [];
  state.recordIds = [];
  state.dataMode = "live";
  state.searchMeta = null;
  renderSearch();
  const tasks = [];
  if (selected.pubmed) tasks.push(["pubmed", fetchPubMedPage(state.query)]);
  if (selected.trials) tasks.push(["trials", fetchClinicalTrialsPage(state.query)]);
  const settled = await Promise.allSettled(tasks.map(([, task]) => task));

  let records = [];
  const sources = {};
  const errors = [];
  settled.forEach((result, index) => {
    const source = tasks[index][0];
    if (result.status === "rejected") {
      errors.push(`${source === "pubmed" ? "PubMed" : "ClinicalTrials.gov"} search failed: ${result.reason.message}`);
      return;
    }
    records = mergeRecords(records, result.value.records);
    sources[source] = sourceMetadata(result.value);
    errors.push(...result.value.errors);
  });

  state.searchRecords = records;
  state.recordIds = records.filter((record) => matchesRecord(record, state.query)).map((record) => record.id);
  state.dataMode = "live";
  state.searchMeta = {
    sources,
    pubmed: sources.pubmed ?? null,
    trials: sources.trials ?? null,
    errors,
    searchedAt: new Date().toISOString(),
    query: { ...state.query }
  };
  state.searchBusy = false;
  persistState();
  renderSearch();
  if (errors.length) toast(errors.join(" "));
  else toast(`${records.length} source records retrieved. Verify each record before screening.`);
}

async function loadMoreResults() {
  if (!state.searchMeta || state.searchBusy) return;
  const tasks = [];
  if (state.searchMeta.pubmed && state.searchMeta.pubmed.nextStart < state.searchMeta.pubmed.total) {
    tasks.push(["pubmed", fetchPubMedPage(state.query, state.searchMeta.pubmed.nextStart)]);
  }
  if (state.searchMeta.trials?.nextPageToken) {
    tasks.push(["trials", fetchClinicalTrialsPage(state.query, state.searchMeta.trials.nextPageToken)]);
  }
  if (!tasks.length) return;

  state.searchBusy = true;
  renderSearch();
  const settled = await Promise.allSettled(tasks.map(([, task]) => task));
  const errors = [...(state.searchMeta.errors ?? [])];
  settled.forEach((result, index) => {
    const source = tasks[index][0];
    if (result.status === "rejected") {
      errors.push(`${source === "pubmed" ? "PubMed" : "ClinicalTrials.gov"} next page failed: ${result.reason.message}`);
      return;
    }
    const previous = state.searchMeta[source];
    const updated = sourceMetadata(result.value, previous);
    state.searchMeta[source] = updated;
    state.searchMeta.sources[source] = updated;
    errors.push(...result.value.errors);
    state.searchRecords = mergeRecords(state.searchRecords, result.value.records);
  });
  state.searchMeta.errors = errors;
  state.recordIds = state.searchRecords.filter((record) => matchesRecord(record, state.query)).map((record) => record.id);
  state.searchBusy = false;
  persistState();
  renderSearch();
  if (errors.length) toast(errors.slice(-2).join(" "));
  else toast("Loaded the next source page.");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted && character === '"' && input[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length < 2) throw new Error("The CSV must include a header row and at least one record.");

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""])));
}

function firstCsvValue(row, ...names) {
  for (const name of names) {
    const value = row[name.toLowerCase()];
    if (value) return value;
  }
  return "";
}

function scopusRecordsFromCsv(text) {
  const rows = parseCsv(text);
  return rows.map((row, index) => {
    const title = firstCsvValue(row, "title");
    if (!title) return null;
    const abstract = firstCsvValue(row, "abstract");
    const eid = firstCsvValue(row, "eid");
    const doi = firstCsvValue(row, "doi");
    const pmid = firstCsvValue(row, "pubmed id", "pmid");
    const nct = `${abstract} ${firstCsvValue(row, "clinical trial number", "nct id")}`.match(/\bNCT\d{8}\b/i)?.[0] ?? "";
    const year = firstCsvValue(row, "year");
    return {
      id: eid ? `SCOPUS-${eid}` : doi ? `DOI-${doi}` : `SCOPUS-ROW-${index + 1}`,
      sourceType: "scopus",
      sources: ["Scopus"],
      title,
      condition: "Review abstract/full text",
      population: "Age and eligibility not structured in Scopus export",
      minAge: null,
      maxAge: null,
      ageLabel: "Verify in abstract/full text",
      intervention: "Review abstract/full text",
      comparator: "Review abstract/full text",
      outcome: "Review abstract/full text",
      design: firstCsvValue(row, "document type") || "Scopus citation",
      year,
      sampleSize: "Not reported in citation",
      publicationStatus: "Scopus export record",
      pmid,
      nct,
      doi,
      eid,
      manualReason: "Verify study design, population, age, intervention, and outcomes against the source.",
      note: abstract || firstCsvValue(row, "author keywords", "index keywords") || "No abstract was included in this Scopus export.",
      abstract,
      sourceUrl: firstCsvValue(row, "link") || (eid ? `https://www.scopus.com/record/display.uri?eid=${encodeURIComponent(eid)}` : "")
    };
  }).filter(Boolean);
}

async function importScopusFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = scopusRecordsFromCsv(await file.text());
    if (!imported.length) throw new Error("No records with titles were found in this CSV.");
    const priorRecords = ["live", "scopus", "mixed"].includes(state.dataMode) ? state.searchRecords : [];
    state.searchRecords = mergeRecords(priorRecords, imported);
    state.dataMode = priorRecords.length ? "mixed" : "scopus";
    state.recordIds = state.searchRecords.filter((record) => matchesRecord(record, state.query)).map((record) => record.id);
    state.manualOnly = false;
    state.expandedRecordId = "";
    state.searchMeta ??= { sources: {}, errors: [], searchedAt: new Date().toISOString(), query: { ...state.query } };
    state.searchMeta.scopus = { imported: imported.length, fileName: file.name, importedAt: new Date().toISOString() };
    persistState();
    renderSearch();
    toast(`Imported ${imported.length} Scopus CSV record${imported.length === 1 ? "" : "s"}.`);
  } catch (error) {
    console.error("Could not import the Scopus CSV.", error);
    toast(`Scopus CSV import failed: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

function loadDemoData() {
  state.dataMode = "demo";
  state.searchRecords = [];
  state.searchMeta = null;
  state.manualOnly = false;
  state.expandedRecordId = "";
  state.recordIds = DEMO_RECORDS.filter((record) => matchesRecord(record, state.query)).map((record) => record.id);
  persistState();
  renderSearch();
  toast("Loaded the clearly labeled synthetic sample set.");
}

function renderSources(record) {
  const sources = [];
  if (record.pmid) {
    const href = record.sourceType === "demo"
      ? sourceSearchUrl("pubmed", record.title)
      : `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(record.pmid)}/`;
    sources.push(`<a href="${href}" target="_blank" rel="noopener noreferrer">PMID ${escapeHtml(record.pmid)} · PubMed ↗</a>`);
  }
  if (record.nct) {
    const href = record.sourceType === "demo"
      ? sourceSearchUrl("registry", record.title)
      : `https://clinicaltrials.gov/study/${encodeURIComponent(record.nct)}`;
    sources.push(`<a class="registry-link" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.nct)} · Registry ↗</a>`);
  }
  if (record.doi) sources.push(`<a href="https://doi.org/${encodeURIComponent(record.doi)}" target="_blank" rel="noopener noreferrer">DOI ${escapeHtml(record.doi)} ↗</a>`);
  if (record.eid) sources.push(`<a href="https://www.scopus.com/record/display.uri?eid=${encodeURIComponent(record.eid)}" target="_blank" rel="noopener noreferrer">Scopus ${escapeHtml(record.eid)} ↗</a>`);
  return sources.length ? sources.join("") : "<span class=\"study-cell-value\">No source identifier</span>";
}

function recordStatus(record) {
  if (record.publicationStatus.startsWith("Completed")) {
    return `<span class="status-chip status-chip--unpublished">${escapeHtml(record.publicationStatus)}</span>`;
  }
  if (isManualReview(record)) {
    return `<span class="status-chip status-chip--manual">Needs manual review</span>`;
  }
  return `<span class="status-chip">Scoping match</span>`;
}

function renderStudy(record) {
  const expanded = state.expandedRecordId === record.id;
  const manual = isManualReview(record);
  const sampleSize = typeof record.sampleSize === "number" ? `n=${record.sampleSize}` : record.sampleSize;
  const metadata = [record.design, record.year, sampleSize].filter(Boolean).join(" · ");
  return `
    <article class="study-row${manual ? " is-manual" : ""}" data-record-id="${escapeHtml(record.id)}">
      <div class="study-cell study-main">
        <button class="study-title-button" type="button" data-action="expand-study" data-id="${escapeHtml(record.id)}" aria-expanded="${expanded}">
          ${escapeHtml(record.title)}
        </button>
        <div class="study-meta">
          <span class="study-code">${escapeHtml(record.id)}</span>
          <span class="study-meta-separator" aria-hidden="true">·</span>
          <span>${escapeHtml(metadata)}</span>
        </div>
      </div>
      <div class="study-cell study-cell--age">
        <span class="study-cell-label">AGE GROUP</span>
        <span class="study-cell-value">${escapeHtml(record.ageLabel)}</span>
      </div>
      <div class="study-cell study-cell--intervention">
        <span class="study-cell-label">INTERVENTION</span>
        <span class="study-cell-value">${escapeHtml(record.intervention)}</span>
      </div>
      <div class="study-cell study-cell--outcome">
        <span class="study-cell-label">OUTCOME</span>
        <span class="study-cell-value">${escapeHtml(record.outcome)}</span>
      </div>
      <div class="study-cell study-cell--source">
        <span class="study-cell-label">SOURCE IDS</span>
        <div class="source-links">${renderSources(record)}</div>
      </div>
      <div class="row-status-cell">${recordStatus(record)}</div>
      <button class="row-detail" type="button" data-action="expand-study" data-id="${escapeHtml(record.id)}" aria-label="${expanded ? "Hide details" : "Show details"} for ${escapeHtml(record.id)}" aria-expanded="${expanded}">${expanded ? "−" : "+"}</button>
      ${expanded ? `<div class="row-expanded"><p><strong>Population:</strong> ${escapeHtml(record.population)}. <strong>Comparator:</strong> ${escapeHtml(record.comparator)}. <strong>Record status:</strong> ${escapeHtml(record.publicationStatus)}.</p><p><strong>Source summary:</strong> ${escapeHtml(record.note)}${manual && record.manualReason ? ` ${escapeHtml(record.manualReason)}` : ""}</p>${record.linkedRecordTitle ? `<p><strong>Linked source record:</strong> ${escapeHtml(record.linkedRecordTitle)}</p>` : ""}</div>` : ""}
    </article>`;
}

function renderSearch() {
  const records = getVisibleRecords();
  const baseCount = state.recordIds.length;
  const manualCount = currentRecords().filter((record) => state.recordIds.includes(record.id) && isManualReview(record)).length;
  elements.resultCount.textContent = String(baseCount);
  elements.manualCount.textContent = String(manualCount);
  elements.manualFilter.setAttribute("aria-pressed", String(state.manualOnly));
  elements.studyList.innerHTML = records.map(renderStudy).join("");
  elements.emptyResults.hidden = records.length > 0;
  elements.studyList.hidden = records.length === 0;

  const ageLabel = selectedAgeGroup(state.query).label;
  if (state.searchBusy) {
    elements.resultsSummary.textContent = "Searching selected sources…";
  } else if (state.dataMode === "live" && state.searchMeta) {
    const totals = [
      state.searchMeta.pubmed && `${state.searchMeta.pubmed.loaded} of ${state.searchMeta.pubmed.total} PubMed`,
      state.searchMeta.trials && `${state.searchMeta.trials.loaded} of ${state.searchMeta.trials.total} trials`
    ].filter(Boolean);
    elements.resultsSummary.textContent = totals.length
      ? `${records.length} records shown · ${totals.join(" · ")} · age ${ageLabel}`
      : "No source records retrieved. See source status below.";
  } else if (state.dataMode === "scopus" || state.dataMode === "mixed") {
    const sourceLabel = state.dataMode === "scopus" ? "Scopus CSV import" : "multiple source records";
    elements.resultsSummary.textContent = `${records.length} records shown · ${sourceLabel} · age ${ageLabel}`;
  } else {
    elements.resultsSummary.textContent = state.manualOnly
      ? `${records.length} manual-review record${records.length === 1 ? "" : "s"} shown of ${baseCount} sample matches`
      : `${records.length} synthetic records shown · age filter ${ageLabel}`;
  }

  const isDemo = state.dataMode === "demo";
  document.getElementById("dataset-stamp").innerHTML = isDemo
    ? `<span aria-hidden="true">✳</span> Synthetic sample`
    : `<span aria-hidden="true">↗</span> ${state.dataMode === "scopus" ? "Scopus export" : state.dataMode === "mixed" ? "Multiple sources" : "Live source records"}`;
  document.getElementById("sort-status").innerHTML = isDemo
    ? `<span class="sort-glyph" aria-hidden="true">↕</span> Synthetic sample · fixed order`
    : `<span class="sort-glyph" aria-hidden="true">↕</span> Source relevance/order · verify against original records`;
  document.getElementById("source-truth-copy").innerHTML = isDemo
    ? "<strong>About these records</strong> — this is the synthetic sample set. Choose live sources above to retrieve current records from PubMed and ClinicalTrials.gov."
    : `<strong>About these records</strong> — retrieved from source databases or imported from a Scopus export. Search is limited to the shown result pages; confirm eligibility, study details, and linked publications at the source. This tool is not PRISMA-validated.${state.searchMeta?.errors?.length ? `<br><strong>Source status:</strong> ${escapeHtml(state.searchMeta.errors.join(" "))}` : ""}`;
  elements.loadMoreRow.hidden = !hasMoreResults();
  elements.loadMoreButton.disabled = state.searchBusy;
  elements.searchButton.disabled = state.searchBusy;
  elements.searchButton.innerHTML = state.searchBusy
    ? `<span aria-hidden="true">⌕</span> Searching…`
    : `<span aria-hidden="true">⌕</span> Search live sources`;
  elements.loadMoreStatus.textContent = state.searchMeta?.errors?.join(" ") ?? "";
  elements.freezeButton.disabled = state.recordIds.length === 0 || Boolean(state.review);
  elements.freezeButton.innerHTML = state.review
    ? `Review already frozen <span aria-hidden="true">✓</span>`
    : `Freeze search for PRISMA review <span aria-hidden="true">→</span>`;
}

function reviewRecords() {
  if (!state.review) return [];
  if (Array.isArray(state.review.records)) return state.review.records;
  const idSet = new Set(state.review.recordIds);
  return currentRecords().filter((record) => idSet.has(record.id));
}

function getDecision(recordId) {
  return state.review?.decisions?.[recordId] ?? { a: "", b: "", consensus: "" };
}

function decisionStatus(decision) {
  if (decision.consensus) {
    return { label: `Consensus · ${decisionLabel(decision.consensus)}`, className: "review-state--consensus" };
  }
  if (decision.a && decision.b && decision.a !== decision.b) {
    return { label: "Needs consensus", className: "" };
  }
  if (decision.a && decision.b) {
    return { label: "In agreement · confirm", className: "review-state--agreement" };
  }
  if (decision.a || decision.b) {
    return { label: "Awaiting second reviewer", className: "review-state--waiting" };
  }
  return { label: "Not screened", className: "review-state--waiting" };
}

function decisionLabel(value) {
  return ({ include: "Include", exclude: "Exclude", unclear: "Unclear" })[value] ?? "Pending";
}

function decisionButton(recordId, reviewer, decision, selected) {
  const label = decisionLabel(decision);
  return `<button class="decision-button" type="button" data-action="review-decision" data-id="${escapeHtml(recordId)}" data-reviewer="${reviewer}" data-decision="${decision}" aria-pressed="${selected === decision}">${label}</button>`;
}

function renderScreeningRecord(record) {
  const decision = getDecision(record.id);
  const status = decisionStatus(decision);
  const bothReviewed = Boolean(decision.a && decision.b);
  const disagreement = bothReviewed && decision.a !== decision.b;
  const wrapperClass = disagreement ? "is-disagreement" : (decision.consensus ? "is-agreement" : "");
  const consensusText = decision.consensus
    ? `Consensus recorded: <strong>${escapeHtml(decisionLabel(decision.consensus))}</strong>`
    : (disagreement ? "<strong>Reviewer choices differ.</strong> Record a consensus decision." : (bothReviewed ? "<strong>Reviewer choices align.</strong> Confirm the decision to continue." : "Consensus becomes available after both reviewers respond."));
  const canRecordConsensus = bothReviewed;

  return `
    <article class="screening-record ${wrapperClass}" data-record-id="${escapeHtml(record.id)}">
      <div class="screen-record-head">
        <div>
          <h3 class="screen-record-title">${escapeHtml(record.title)}</h3>
          <p class="screen-record-subtitle">${escapeHtml(record.id)} · ${escapeHtml(record.ageLabel)} · ${escapeHtml(record.design)}</p>
        </div>
        <span class="review-state ${status.className}">${escapeHtml(status.label)}</span>
      </div>
      <div class="screen-record-reviewers">
        <div class="reviewer-box">
          <div class="reviewer-box-head"><span>REVIEWER A</span><span>Independent vote</span></div>
          <div class="decision-buttons" role="group" aria-label="Reviewer A screening decision for ${escapeHtml(record.id)}">
            ${decisionButton(record.id, "a", "include", decision.a)}
            ${decisionButton(record.id, "a", "exclude", decision.a)}
            ${decisionButton(record.id, "a", "unclear", decision.a)}
          </div>
        </div>
        <div class="reviewer-box">
          <div class="reviewer-box-head"><span>REVIEWER B</span><span>Independent vote</span></div>
          <div class="decision-buttons" role="group" aria-label="Reviewer B screening decision for ${escapeHtml(record.id)}">
            ${decisionButton(record.id, "b", "include", decision.b)}
            ${decisionButton(record.id, "b", "exclude", decision.b)}
            ${decisionButton(record.id, "b", "unclear", decision.b)}
          </div>
        </div>
      </div>
      <div class="consensus-bar">
        <span class="consensus-copy">${consensusText}</span>
        <div class="consensus-actions">
          ${canRecordConsensus ? `
            <button class="consensus-button" type="button" data-action="consensus" data-id="${escapeHtml(record.id)}" data-decision="include">Consensus: include</button>
            <button class="consensus-button consensus-button--exclude" type="button" data-action="consensus" data-id="${escapeHtml(record.id)}" data-decision="exclude">Consensus: exclude</button>
            <button class="consensus-button consensus-button--clear" type="button" data-action="consensus" data-id="${escapeHtml(record.id)}" data-decision="unclear">Needs discussion</button>
          ` : ""}
          ${decision.consensus ? `<button class="consensus-button consensus-button--clear" type="button" data-action="clear-consensus" data-id="${escapeHtml(record.id)}">Reopen</button>` : ""}
        </div>
      </div>
    </article>`;
}

function countFlow() {
  const records = reviewRecords();
  const decisions = records.map((record) => getDecision(record.id));
  const screened = decisions.filter((decision) => decision.a || decision.b).length;
  const disagreements = decisions.filter((decision) => decision.a && decision.b && decision.a !== decision.b && !decision.consensus).length;
  const included = decisions.filter((decision) => decision.consensus === "include").length;
  const excluded = decisions.filter((decision) => decision.consensus === "exclude").length;
  const live = state.review?.dataMode !== "demo";
  const duplicatesRemoved = state.review?.duplicatesRemoved ?? 0;
  const ageFilteredOut = state.review?.ageFilteredOut ?? 0;
  const rawRetrieved = state.review?.rawRetrieved ?? records.length + duplicatesRemoved + ageFilteredOut;
  const totalSourceHits = state.review?.searchDetails
    ? [
        state.review.searchDetails.pubmed?.total,
        state.review.searchDetails.trials?.total,
        state.review.searchDetails.scopus?.imported
      ].filter(Number.isFinite).reduce((sum, value) => sum + value, 0)
    : rawRetrieved;
  return [
    { label: "Records identified", count: rawRetrieved, note: live ? `${rawRetrieved - duplicatesRemoved} unique loaded · ${ageFilteredOut} outside age filter · ${totalSourceHits} reported source hits` : "synthetic sample set" },
    { label: "Duplicates removed", count: duplicatesRemoved, note: live ? "matched by PMID, NCT ID, DOI, or Scopus EID" : "deduplication not simulated" },
    { label: "Records screened", count: screened, note: `${screened} with a reviewer decision of ${records.length} queued` },
    { label: "Needs consensus", count: disagreements, note: "reviewer disagreement" },
    { label: "Consensus included", count: included, note: "at title / abstract stage" },
    { label: "Consensus excluded", count: excluded, note: "at title / abstract stage" }
  ];
}

function renderFlowCounts() {
  const counts = countFlow();
  elements.flowCounts.innerHTML = counts.map((item) => `
    <div class="flow-count">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(String(item.count))}</strong>
      <small>${escapeHtml(item.note)}</small>
    </div>`).join("");
}

function renderAudit() {
  const audit = state.review?.audit ?? [];
  if (!audit.length) {
    elements.auditList.innerHTML = `<li class="audit-empty">No local actions recorded yet.</li>`;
    return;
  }
  elements.auditList.innerHTML = [...audit].reverse().map((entry) => `
    <li class="audit-item">
      <strong>${escapeHtml(entry.action)}</strong>
      <time datetime="${escapeHtml(entry.at)}">${escapeHtml(formatDate(entry.at))} · ${escapeHtml(formatTime(entry.at))}</time>
      <span>${escapeHtml(entry.actor)}${entry.recordId ? ` · ${escapeHtml(entry.recordId)}` : ""}</span>
    </li>`).join("");
}

function frozenQueryLabel(query) {
  const parts = [
    query.population && `P: ${query.population}`,
    query.intervention && `I: ${query.intervention}`,
    query.comparator && `C: ${query.comparator}`,
    query.outcome && `O: ${query.outcome}`,
    `Age: ${selectedAgeGroup(query).label}`,
    query.strictAge ? "exact age" : "mixed age flagged"
  ].filter(Boolean);
  return parts.join("  ·  ");
}

function renderScreening() {
  if (!state.review) return;
  const records = reviewRecords();
  elements.frozenDate.textContent = `Saved ${formatDate(state.review.frozenAt)}`;
  elements.frozenSummary.textContent = frozenQueryLabel(state.review.query);
  elements.screeningQueueCount.textContent = String(records.length);
  document.getElementById("flow-count-label").textContent = state.review.dataMode === "demo"
    ? "REVIEW PROGRESS · DEMO COUNTS"
    : "REVIEW PROGRESS · LOADED SOURCE COUNTS";
  document.getElementById("review-notice-copy").innerHTML = state.review.dataMode === "demo"
    ? "<strong>Illustrative workflow state.</strong> Records, sample decisions, and extraction values are synthetic. This workflow has not been validated for PRISMA compliance."
    : "<strong>Research limitation.</strong> Verify each record against its original source. Screening decisions are local to this browser, and this workflow has not been validated for PRISMA compliance.";
  elements.screeningList.innerHTML = records.map(renderScreeningRecord).join("");
  renderFlowCounts();
  renderAudit();
}

function includedRecords() {
  return reviewRecords().filter((record) => getDecision(record.id).consensus === "include");
}

function ensureExtraction(record) {
  if (!state.extraction[record.id]) {
    state.extraction[record.id] = {
      outcome: state.review?.dataMode === "demo" ? record.outcome : "",
      timepoint: "",
      measure: "Risk ratio",
      value: "",
      ci: "",
      sampleSize: "",
      units: "",
      sourceText: "",
      locator: "",
      reviewer: "Reviewer A",
      updatedAt: ""
    };
  }
}

function renderExtraction() {
  const records = includedRecords();
  const formControls = [...elements.extractionForm.elements];
  if (!records.length) {
    elements.extractionContext.innerHTML = `
      <div><strong>No studies have reached an include consensus yet.</strong><small>Return to dual screening and record a consensus decision before extracting.</small></div>
      <button class="text-button" type="button" data-action="go-screening">Open screening <span aria-hidden="true">→</span></button>`;
    elements.extractionForm.hidden = true;
    formControls.forEach((control) => { control.disabled = true; });
    document.querySelector(".extraction-main > .extraction-heading-row").hidden = true;
    return;
  }

  document.querySelector(".extraction-main > .extraction-heading-row").hidden = false;
  elements.extractionForm.hidden = false;
  formControls.forEach((control) => { control.disabled = false; });
  let selectedId = state.extraction.activeRecordId;
  if (!records.some((record) => record.id === selectedId)) selectedId = records[0].id;
  state.extraction.activeRecordId = selectedId;
  const record = records.find((item) => item.id === selectedId);
  ensureExtraction(record);
  const data = state.extraction[record.id];
  const extractionTag = document.getElementById("extraction-data-tag");
  extractionTag.classList.toggle("is-source-data", state.review?.dataMode !== "demo");
  extractionTag.innerHTML = state.review?.dataMode === "demo"
    ? `<span aria-hidden="true">✳</span> Synthetic example`
    : `<span aria-hidden="true">↗</span> Manual source entry`;

  elements.extractionContext.innerHTML = `
    <div>
      <strong>${escapeHtml(record.title)}</strong>
      <small>${escapeHtml(record.id)} · Included by consensus · ${state.review?.dataMode === "demo" ? "Synthetic study record" : escapeHtml((record.sources ?? []).join(", ") || "Imported source record")}</small>
    </div>
    <label class="sr-only" for="extraction-study-select">Choose an included study</label>
    <select id="extraction-study-select" aria-label="Choose included study">
      ${records.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === record.id ? "selected" : ""}>${escapeHtml(item.id)} · ${escapeHtml(item.title)}</option>`).join("")}
    </select>`;

  elements.extractionForm.outcome.value = data.outcome ?? "";
  elements.extractionForm.timepoint.value = data.timepoint ?? "";
  elements.extractionForm.measure.value = data.measure ?? "Risk ratio";
  elements.extractionForm.value.value = data.value ?? "";
  elements.extractionForm.ci.value = data.ci ?? "";
  elements.extractionForm.sampleSize.value = data.sampleSize ?? "";
  elements.extractionForm.units.value = data.units ?? "";
  elements.extractionForm.sourceText.value = data.sourceText ?? "";
  elements.extractionForm.locator.value = data.locator ?? "";
  elements.extractionForm.reviewer.value = data.reviewer ?? "Reviewer A";
  elements.extractionSaved.textContent = data.updatedAt
    ? `Saved locally ${formatDate(data.updatedAt)} at ${formatTime(data.updatedAt)}.`
    : state.review?.dataMode === "demo"
      ? "Synthetic demo template. Save your extraction edits locally in this browser."
      : "Enter values from the original source and record a locator before saving.";
}

function renderMode() {
  const isPrisma = state.mode === "prisma" && state.review;
  elements.modeScoping.classList.toggle("is-active", !isPrisma);
  elements.modeScoping.setAttribute("aria-selected", String(!isPrisma));
  elements.modePrisma.classList.toggle("is-active", Boolean(isPrisma));
  elements.modePrisma.setAttribute("aria-selected", String(Boolean(isPrisma)));
  elements.prismaTabStatus.textContent = state.review ? "Frozen snapshot" : "Not started";
  elements.modeDescription.textContent = isPrisma
    ? "Work from the frozen search snapshot. Screening and extraction changes are kept separately from scoping."
    : "Explore the evidence set, adjust your question, and inspect promising records.";
}

function renderNavigation() {
  const viewTitles = { search: "Evidence search", screening: "Dual screening", extraction: "Data extraction" };
  elements.topbarCurrent.textContent = viewTitles[state.view] ?? viewTitles.search;
  document.querySelectorAll(".nav-item[data-view]").forEach((button) => {
    const view = button.dataset.view;
    button.classList.toggle("is-active", view === state.view);
    button.disabled = view !== "search" && !state.review;
  });
  document.getElementById("screening-count").textContent = state.review ? String(state.review.recordIds.length) : "—";
}

function renderView() {
  const views = {
    search: document.getElementById("view-search"),
    screening: document.getElementById("view-screening"),
    extraction: document.getElementById("view-extraction")
  };
  Object.entries(views).forEach(([name, view]) => {
    const active = name === state.view;
    view.hidden = !active;
    view.classList.toggle("is-visible", active);
  });
  document.getElementById("workspace-status").lastChild.textContent = {
    demo: " DEMO SAMPLE",
    live: " LIVE SEARCH",
    scopus: " SCOPUS IMPORT",
    mixed: " MULTIPLE SOURCES"
  }[state.dataMode];
  renderNavigation();
  renderMode();
  if (state.view === "search") renderSearch();
  if (state.view === "screening") renderScreening();
  if (state.view === "extraction") renderExtraction();
}

function renderApp() {
  fillForm(state.query);
  renderView();
}

function recordActivity(action, actor = "Workspace", recordId = "") {
  if (!state.review) return;
  state.review.audit ??= [];
  state.review.audit.push({ action, actor, recordId, at: new Date().toISOString() });
  state.review.audit = state.review.audit.slice(-80);
}

function initialDemoDecisions(recordIds) {
  const decisions = {};
  recordIds.forEach((id) => { decisions[id] = { a: "", b: "", consensus: "" }; });

  if (decisions["D-001"]) decisions["D-001"] = { a: "include", b: "include", consensus: "include" };
  if (decisions["D-002"]) decisions["D-002"] = { a: "include", b: "exclude", consensus: "" };
  if (decisions["D-003"]) decisions["D-003"] = { a: "include", b: "", consensus: "" };
  if (decisions["D-004"]) decisions["D-004"] = { a: "", b: "", consensus: "" };

  return decisions;
}

function freezeReview() {
  if (state.review) {
    toast("This review already has a frozen search snapshot. Return to Scoping to continue exploring.");
    return;
  }
  if (!state.recordIds.length) {
    toast("Run a search with at least one match before freezing a review.");
    return;
  }

  const recordIdSet = new Set(state.recordIds);
  const records = currentRecords().filter((record) => recordIdSet.has(record.id));
  const demo = state.dataMode === "demo";
  const rawRetrieved = demo
    ? records.length
    : [
        state.searchMeta?.pubmed?.loaded,
        state.searchMeta?.trials?.loaded,
        state.searchMeta?.scopus?.imported
      ].filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
  const uniqueRetrieved = demo ? records.length : state.searchRecords.length;
  const sourceLabel = {
    demo: "Synthetic demo set",
    live: "PubMed and ClinicalTrials.gov search",
    scopus: "Scopus CSV export",
    mixed: "Live search and Scopus CSV"
  }[state.dataMode];
  const decisions = demo
    ? initialDemoDecisions(state.recordIds)
    : Object.fromEntries(state.recordIds.map((id) => [id, { a: "", b: "", consensus: "" }]));
  const duplicatesRemoved = demo ? 0 : Math.max(0, rawRetrieved - uniqueRetrieved);
  state.review = {
    frozenAt: new Date().toISOString(),
    query: { ...state.query },
    recordIds: [...state.recordIds],
    records: structuredClone(records),
    dataMode: state.dataMode,
    searchDetails: state.searchMeta ? structuredClone(state.searchMeta) : null,
    rawRetrieved,
    duplicatesRemoved,
    ageFilteredOut: Math.max(0, uniqueRetrieved - records.length),
    sourceLabel,
    decisions,
    audit: [{
      action: demo ? "Synthetic sample and query frozen for this demo review." : "Source records and query frozen for local screening.",
      actor: "Workspace",
      recordId: "",
      at: new Date().toISOString()
    }, ...(demo ? [{
      action: "Synthetic Reviewer A/B sample decisions loaded for demonstration.",
      actor: "Demo data",
      recordId: "",
      at: new Date().toISOString()
    }] : [])]
  };
  if (demo && state.recordIds.includes("D-001")) state.extraction["D-001"] = { ...DEFAULT_EXTRACTION, updatedAt: "" };
  state.extraction.activeRecordId = state.recordIds[0];
  state.mode = "prisma";
  state.view = "screening";
  persistState();
  renderView();
  toast("Search frozen. Scoping edits will not change this review snapshot.");
  document.getElementById("screening-title").focus();
}

function setView(view) {
  if (view !== "search" && !state.review) {
    toast("Freeze a Scoping search to start a PRISMA-style review.");
    return;
  }
  if (view !== "search") state.mode = "prisma";
  else if (state.mode === "prisma") state.mode = "scoping";
  state.view = view;
  persistState();
  renderView();
  window.scrollTo({ top: 0, behavior: "smooth" });
  const headingId = { search: "search-title", screening: "screening-title", extraction: "extraction-title" }[view];
  document.getElementById(headingId)?.focus();
}

function setReviewDecision(recordId, reviewer, value) {
  const decision = getDecision(recordId);
  const previous = decision[reviewer];
  if (previous === value) return;
  decision[reviewer] = value;
  decision.consensus = "";
  state.review.decisions[recordId] = decision;
  const reviewerName = `Reviewer ${reviewer.toUpperCase()}${state.review.dataMode === "demo" ? " (demo)" : ""}`;
  recordActivity(`${reviewerName} changed decision to ${decisionLabel(value)}.`, reviewerName, recordId);
  persistState();
  renderScreening();
}

function setConsensus(recordId, value) {
  const decision = getDecision(recordId);
  if (!decision.a || !decision.b) {
    toast("Both reviewers need to record a decision before consensus can be saved.");
    return;
  }
  decision.consensus = value;
  state.review.decisions[recordId] = decision;
  recordActivity(`Consensus recorded: ${decisionLabel(value)}.`, `Review team${state.review.dataMode === "demo" ? " (demo)" : ""}`, recordId);
  persistState();
  renderScreening();
}

function clearConsensus(recordId) {
  const decision = getDecision(recordId);
  decision.consensus = "";
  state.review.decisions[recordId] = decision;
  recordActivity("Consensus reopened for discussion.", `Review team${state.review.dataMode === "demo" ? " (demo)" : ""}`, recordId);
  persistState();
  renderScreening();
}

function downloadFile(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function reviewExportData() {
  if (!state.review) return null;
  const demo = state.review.dataMode === "demo";
  const limitations = demo
    ? [
        "Records, identifiers, sample reviewer decisions, audit entries, and extraction examples are synthetic.",
        "The review flow is illustrative and has not been validated for PRISMA compliance."
      ]
    : [
        ...(state.review.dataMode === "live" || state.review.dataMode === "mixed"
          ? ["Verify retrieved records against the original source; API retrieval may be incomplete and pagination limits apply."]
          : []),
        ...(state.review.dataMode === "scopus" || state.review.dataMode === "mixed"
          ? ["Scopus records are user-imported CSV data, not a Scopus API integration."]
          : []),
        "Screening decisions and audit entries are stored only in this browser; this is not multi-user review or validated PRISMA software."
      ];
  const counts = Object.fromEntries(countFlow().map((item) => [item.label, item.count]));
  return {
    schemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    demoOnly: demo,
    dataMode: state.review.dataMode,
    sources: state.review.searchDetails ?? null,
    limitations,
    review: {
      frozenAt: state.review.frozenAt,
      sourceLabel: state.review.sourceLabel,
      query: state.review.query,
      querySummary: frozenQueryLabel(state.review.query),
      recordIds: state.review.recordIds,
      counts
    },
    records: reviewRecords().map((record) => ({
      ...record,
      decisions: getDecision(record.id),
      extraction: state.extraction[record.id] ?? null
    })),
    audit: state.review.audit ?? []
  };
}

function exportReview() {
  if (!state.review) {
    toast("Freeze a search before exporting a review.");
    return;
  }
  recordActivity("Exported the review JSON package.", "Workspace");
  const data = reviewExportData();
  downloadFile("clinical-evidence-review.json", JSON.stringify(data, null, 2), "application/json;charset=utf-8");
  persistState();
  renderAudit();
  toast("Review JSON exported with source metadata and limitations.");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function exportCsv() {
  const records = includedRecords();
  if (!records.length) {
    toast("No consensus-included studies are available for extraction.");
    return;
  }
  const header = ["Study ID", "Title", "Outcome", "Timepoint", "Effect measure", "Estimate", "95% CI", "Participants (intervention / comparator)", "Units", "Source excerpt", "Page/table/figure", "Extracted by", "Updated at", "Synthetic demo data"];
  const rows = records.map((record) => {
    const data = state.extraction[record.id] ?? {};
    return [
      record.id, record.title, data.outcome, data.timepoint, data.measure, data.value,
      data.ci, data.sampleSize, data.units, data.sourceText, data.locator,
      data.reviewer, data.updatedAt, record.sourceType === "demo" ? "Yes" : "No"
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadFile("clinical-evidence-extraction.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
  recordActivity("Exported the quantitative extraction CSV.", "Workspace");
  persistState();
  renderAudit();
  toast("Extraction CSV exported with a synthetic-data indicator for each row.");
}

function saveExtraction(event) {
  event.preventDefault();
  const recordId = state.extraction.activeRecordId;
  const record = includedRecords().find((item) => item.id === recordId);
  if (!record) {
    toast("Select an included study before saving extraction.");
    return;
  }

  const formData = new FormData(elements.extractionForm);
  const data = Object.fromEntries(formData.entries());
  data.updatedAt = new Date().toISOString();
  state.extraction[record.id] = data;
  recordActivity(`Saved quantitative extraction for ${record.id}.`, data.reviewer || "Reviewer", record.id);
  persistState();
  elements.extractionSaved.textContent = `Saved locally ${formatDate(data.updatedAt)} at ${formatTime(data.updatedAt)}.`;
  toast(`Extraction for ${record.id} saved in this browser.`);
}

function applySearch() {
  void searchLiveSources();
}

function resetSearch() {
  if (state.review) {
    state.query = { ...DEFAULT_QUERY };
    fillForm(state.query);
    state.recordIds = currentRecords().filter((record) => matchesRecord(record, state.query)).map((record) => record.id);
    state.manualOnly = false;
    persistState();
    renderSearch();
    toast("Scoping question reset. The frozen review is unchanged.");
    return;
  }
  state.query = { ...DEFAULT_QUERY };
  state.manualOnly = false;
  fillForm(state.query);
  state.recordIds = currentRecords().filter((record) => matchesRecord(record, state.query)).map((record) => record.id);
  persistState();
  renderSearch();
}

function handleDelegatedClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id, reviewer, decision } = button.dataset;

  if (action === "expand-study") {
    state.expandedRecordId = state.expandedRecordId === id ? "" : id;
    renderSearch();
  } else if (action === "review-decision") {
    setReviewDecision(id, reviewer, decision);
  } else if (action === "consensus") {
    setConsensus(id, decision);
  } else if (action === "clear-consensus") {
    clearConsensus(id);
  } else if (action === "go-screening") {
    setView("screening");
  }
}

function bindEvents() {
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;
    applySearch();
  });

  elements.form.addEventListener("input", () => {
    if (state.review) return;
    state.query = readForm();
    persistState();
  });
  elements.age.addEventListener("change", updateAgeSelection);
  elements.ageMinimum.addEventListener("input", updateAgeSelection);
  elements.ageMaximum.addEventListener("input", updateAgeSelection);
  elements.strictAge.addEventListener("change", updateAgeSelection);

  document.getElementById("reset-search").addEventListener("click", resetSearch);
  elements.loadMoreButton.addEventListener("click", () => { void loadMoreResults(); });
  elements.scopusImportButton.addEventListener("click", () => elements.scopusImport.click());
  elements.scopusImport.addEventListener("change", (event) => { void importScopusFile(event); });
  document.getElementById("freeze-review").addEventListener("click", freezeReview);
  document.getElementById("start-review-bottom").addEventListener("click", freezeReview);
  document.getElementById("manual-filter").addEventListener("click", () => {
    state.manualOnly = !state.manualOnly;
    persistState();
    renderSearch();
  });
  document.querySelectorAll(".mode-tab").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.mode === "scoping") {
        state.mode = "scoping";
        state.view = "search";
        persistState();
        renderView();
      } else if (state.review) {
        state.mode = "prisma";
        state.view = "screening";
        persistState();
        renderView();
      } else {
        toast("Freeze a Scoping search to create a PRISMA-style review snapshot.");
      }
    });
  });
  document.querySelectorAll(".nav-item[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.getElementById("return-to-scope").addEventListener("click", () => setView("search"));
  document.getElementById("export-review").addEventListener("click", exportReview);
  document.getElementById("export-review-aside").addEventListener("click", exportReview);
  document.getElementById("export-csv").addEventListener("click", exportCsv);
  elements.studyList.addEventListener("click", handleDelegatedClick);
  elements.screeningList.addEventListener("click", handleDelegatedClick);
  elements.extractionContext.addEventListener("click", handleDelegatedClick);
  elements.extractionContext.addEventListener("change", (event) => {
    if (event.target.id !== "extraction-study-select") return;
    state.extraction.activeRecordId = event.target.value;
    persistState();
    renderExtraction();
  });
  elements.extractionForm.addEventListener("submit", saveExtraction);
  document.getElementById("help-button").addEventListener("click", () => elements.aboutDialog.showModal());
  document.getElementById("close-about").addEventListener("click", () => elements.aboutDialog.close());
  document.getElementById("about-done").addEventListener("click", () => elements.aboutDialog.close());
  elements.aboutDialog.addEventListener("click", (event) => {
    if (event.target === elements.aboutDialog) elements.aboutDialog.close();
  });
}

restoreState();
bindEvents();
renderApp();
