import { useEffect, useMemo, useState } from "react";
import {
  apiGet,
  apiPost,
  type ActionLogEntry,
  type ApplicationKitView,
  type ImportResult,
  type OperatorSettings,
  type Opportunity,
  type OpportunityListResponse,
  type PackView,
  type PipelineStatus,
  type PriorityBand,
  type ResumeVersion
} from "./api";

type View =
  | "dashboard"
  | "import"
  | "opportunities"
  | "shortlist"
  | "packs"
  | "pipeline"
  | "resumes"
  | "kit"
  | "settings";

type OpportunityQuickFilter =
  | "all"
  | "new"
  | "unscored"
  | "apply-today"
  | "high-fit"
  | "low-risk"
  | "remote-global"
  | "deadline-soon"
  | "packs-review"
  | "kits-ready"
  | "follow-ups-due"
  | "stale"
  | "not-worth-touching";

type CopyText = (label: string, value: string) => Promise<void>;

const views: Array<{ key: View; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "import", label: "Import" },
  { key: "opportunities", label: "Opportunities" },
  { key: "shortlist", label: "Shortlist" },
  { key: "packs", label: "Pack Viewer" },
  { key: "pipeline", label: "Pipeline" },
  { key: "resumes", label: "Resume Library" },
  { key: "kit", label: "Kit Builder" },
  { key: "settings", label: "Settings" }
];

const pipelineColumns: PipelineStatus[] = [
  "new",
  "scored",
  "shortlisted",
  "review_ready",
  "applied",
  "follow_up_due",
  "interview",
  "rejected",
  "closed",
  "ignored"
];

const priorityBands: PriorityBand[] = ["A", "B", "C", "D"];

export function App() {
  const [view, setView] = useState<View>("dashboard");
  const [data, setData] = useState<OpportunityListResponse | null>(null);
  const [settings, setSettings] = useState<OperatorSettings | null>(null);
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickFilter, setQuickFilter] = useState<OpportunityQuickFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [busyLabel, setBusyLabel] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const [opportunityData, settingsData, resumeData, logs] = await Promise.all([
      apiGet<OpportunityListResponse>("/api/opportunities"),
      apiGet<OperatorSettings>("/api/settings"),
      apiGet<{ resumes: ResumeVersion[] }>("/api/resumes"),
      apiGet<{ entries: ActionLogEntry[] }>("/api/action-log")
    ]);

    setData(opportunityData);
    setSettings(settingsData);
    setResumes(resumeData.resumes);
    setActionLog(logs.entries.slice(-12).reverse());
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setError("");
    setMessage("");
    setBusyLabel(label);

    try {
      await action();
      await refresh();
      setMessage(label);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusyLabel("");
    }
  }

  async function copyText(label: string, value: string) {
    setError("");
    setMessage("");

    try {
      await navigator.clipboard.writeText(value);
      setMessage(`Copied ${label}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function navigate(nextView: View, preset?: OpportunityQuickFilter) {
    if (preset) {
      setQuickFilter(preset);
    }

    setView(nextView);
  }

  useEffect(() => {
    refresh()
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : String(caught))
      )
      .finally(() => setIsLoading(false));
  }, []);

  const opportunities = data?.opportunities ?? [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>JATA Lite</strong>
          <span>Operator Console</span>
        </div>
        <nav aria-label="Operator views">
          {views.map((item) => (
            <button
              key={item.key}
              className={view === item.key ? "active" : ""}
              onClick={() => setView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mode-pill">
          <span>{settings?.mode ?? "local"}</span>
          <strong>{settings?.aiProviderMode ?? "mock"}</strong>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">v0.4 local operator workflow</p>
            <h1>{views.find((item) => item.key === view)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button
              onClick={() =>
                runAction("Refreshed local state.", async () => undefined)
              }
            >
              Refresh
            </button>
            <button
              className="primary"
              onClick={() => navigate("opportunities", "apply-today")}
            >
              Apply-Today Queue
            </button>
          </div>
        </header>

        {busyLabel ? <div className="notice working">Working: {busyLabel}</div> : null}
        {message ? <div className="notice success">{message}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}
        {isLoading && !data ? (
          <section className="panel">
            <h2>Loading Local Console</h2>
            <p className="muted">Reading local opportunities, settings, resumes, and action logs.</p>
          </section>
        ) : null}

        {view === "dashboard" && data ? (
          <Dashboard
            data={data}
            actionLog={actionLog}
            navigate={navigate}
            runAction={runAction}
          />
        ) : null}
        {view === "import" ? (
          <ImportView runAction={runAction} />
        ) : null}
        {view === "opportunities" ? (
          <OpportunitiesView
            opportunities={opportunities}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            quickFilter={quickFilter}
            setQuickFilter={setQuickFilter}
            runAction={runAction}
          />
        ) : null}
        {view === "shortlist" ? (
          <ShortlistView
            opportunities={opportunities}
            selectedIds={[...selectedIds]}
            runAction={runAction}
          />
        ) : null}
        {view === "packs" ? (
          <PackViewer
            opportunities={opportunities}
            runAction={runAction}
            copyText={copyText}
          />
        ) : null}
        {view === "pipeline" ? (
          <PipelineView opportunities={opportunities} runAction={runAction} />
        ) : null}
        {view === "resumes" ? (
          <ResumeLibrary resumes={resumes} runAction={runAction} />
        ) : null}
        {view === "kit" ? (
          <KitBuilder
            opportunities={opportunities}
            resumes={resumes}
            runAction={runAction}
            copyText={copyText}
          />
        ) : null}
        {view === "settings" && settings ? (
          <SettingsView settings={settings} runAction={runAction} />
        ) : null}
      </main>
    </div>
  );
}

function Dashboard({
  data,
  actionLog,
  navigate,
  runAction
}: {
  data: OpportunityListResponse;
  actionLog: ActionLogEntry[];
  navigate: (view: View, preset?: OpportunityQuickFilter) => void;
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const counts = data.summary.operatorCounts;
  const activeOpportunities = data.opportunities.filter(isActiveOpportunity);
  const unscored = activeOpportunities.filter((item) => !item.score);
  const topPackCandidates = activeOpportunities.filter(
    (item) =>
      ["A", "B"].includes(item.priorityBand ?? "") &&
      !hasGeneratedPack(item)
  );
  const generatedPacks = activeOpportunities.filter(hasGeneratedPack);
  const kitsToBuild = generatedPacks.filter((item) => !item.applicationKitDir);
  const pipelineUpdates = activeOpportunities.filter(
    (item) => item.applicationKitDir || isFollowUpDue(item, today())
  );
  const commandItems = [
    {
      label: "New opportunities",
      value: counts.newOpportunities,
      preset: "new" as const,
      view: "opportunities" as const
    },
    {
      label: "Unscored",
      value: counts.unscoredOpportunities,
      preset: "unscored" as const,
      view: "opportunities" as const
    },
    {
      label: "A-band",
      value: counts.aBandOpportunities,
      preset: "high-fit" as const,
      view: "opportunities" as const
    },
    {
      label: "Packs to review",
      value: counts.packsNeedingReview,
      preset: "packs-review" as const,
      view: "packs" as const
    },
    {
      label: "Kits ready",
      value: counts.kitsReadyToApply,
      preset: "kits-ready" as const,
      view: "opportunities" as const
    },
    {
      label: "Follow-ups due",
      value: counts.followUpsDue,
      preset: "follow-ups-due" as const,
      view: "pipeline" as const
    },
    {
      label: "Stale",
      value: counts.staleOpportunities,
      preset: "stale" as const,
      view: "opportunities" as const
    }
  ];
  const workflowSteps = [
    {
      step: "Step 1",
      title: "Import or review new opportunities",
      count: counts.newOpportunities,
      action: "Open import",
      onClick: () => navigate(counts.newOpportunities > 0 ? "opportunities" : "import", "new")
    },
    {
      step: "Step 2",
      title: "Score unscored opportunities",
      count: unscored.length,
      action: "Score unscored",
      onClick: () =>
        runAction("Unscored opportunities scored locally.", async () => {
          await apiPost("/api/score/bulk", {
            ids: unscored.map((item) => item.id)
          });
        })
    },
    {
      step: "Step 3",
      title: "Generate top A/B packs",
      count: topPackCandidates.length,
      action: "Generate A/B packs",
      onClick: () =>
        runAction("A/B review packs generated.", async () => {
          await apiPost("/api/generate-batch", {
            ids: topPackCandidates.map((item) => item.id)
          });
        })
    },
    {
      step: "Step 4",
      title: "Review claims",
      count: generatedPacks.length,
      action: "Open pack viewer",
      onClick: () => navigate("packs")
    },
    {
      step: "Step 5",
      title: "Build final application kits",
      count: kitsToBuild.length,
      action: "Open kit builder",
      onClick: () => navigate("kit")
    },
    {
      step: "Step 6",
      title: "Mark applied, follow-up, or ignored",
      count: pipelineUpdates.length,
      action: "Open pipeline",
      onClick: () => navigate("pipeline")
    }
  ];

  return (
    <section className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Operator Command Center</h2>
            <p className="muted">Fast routing for the work that saves time today.</p>
          </div>
          <button onClick={() => navigate("opportunities", "apply-today")}>
            Open Apply-Today Filter
          </button>
        </div>
        <div className="command-grid">
          {commandItems.map((item) => (
            <button
              className="metric action"
              key={item.label}
              onClick={() => navigate(item.view, item.preset)}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Today's Workflow</h2>
            <p className="muted">Follow this order before opening job sites or editing files manually.</p>
          </div>
        </div>
        <div className="workflow-list">
          {workflowSteps.map((item) => (
            <article className="workflow-step" key={item.step}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <em>{item.count}</em>
              <button onClick={item.onClick} disabled={item.count === 0 && item.step !== "Step 1"}>
                {item.action}
              </button>
            </article>
          ))}
        </div>
      </section>
      <div className="metric-grid">
        {[
          ["Total", data.summary.total],
          ["Band A", data.summary.priorityBands.A],
          ["Band B", data.summary.priorityBands.B],
          ["Urgent", data.summary.urgentDeadlines],
          ["Review-ready", data.summary.reviewReadyPacks],
          ["Follow-ups", data.summary.followUpsDue]
        ].map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="two-column">
        <section className="panel">
          <h2>Today's Recommended Actions</h2>
          <ul className="clean-list">
            {data.recommendedActions.length === 0 ? (
              <li>No active opportunities yet.</li>
            ) : (
              data.recommendedActions.map((item) => <li key={item}>{item}</li>)
            )}
          </ul>
        </section>
        <section className="panel">
          <h2>Latest Local Actions</h2>
          <ul className="clean-list">
            {actionLog.length === 0 ? (
              <li>No local actions logged yet.</li>
            ) : (
              actionLog.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.action}</strong>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </section>
  );
}

function ImportView({
  runAction
}: {
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [content, setContent] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function readFile(file: File) {
    const text = await file.text();
    setContent(text);
    setFormat(file.name.toLowerCase().endsWith(".json") ? "json" : "csv");
  }

  return (
    <section className="stack">
      <div
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) {
            void readFile(file);
          }
        }}
      >
        <input
          type="file"
          accept=".csv,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void readFile(file);
            }
          }}
        />
        <span>Drop CSV/JSON or choose a file</span>
      </div>
      <div className="panel">
        <div className="form-row">
          <label>
            Format
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as "csv" | "json")}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
        </div>
        <label>
          Paste opportunities
          <textarea
            value={content}
            rows={12}
            onChange={(event) => setContent(event.target.value)}
            placeholder="company,role,description,url,method"
          />
        </label>
        <div className="button-row">
          <button
            disabled={!content.trim()}
            onClick={() =>
              runAction("Import preview complete.", async () => {
                const preview = await apiPost<ImportResult>("/api/import/preview", {
                  format,
                  content
                });
                setResult(preview);
              })
            }
          >
            Dry-Run Preview
          </button>
          <button
            className="primary"
            disabled={!content.trim()}
            onClick={() =>
              runAction("Import committed to local storage.", async () => {
                const commit = await apiPost<ImportResult>("/api/import/commit", {
                  format,
                  content
                });
                setResult(commit);
              })
            }
          >
            Commit Import
          </button>
        </div>
      </div>
      {!content.trim() ? (
        <EmptyState
          title="No import content loaded"
          body="Drop a CSV/JSON file or paste rows here. Use Dry-Run Preview before committing."
        />
      ) : null}
      {result ? <ImportSummary result={result} /> : null}
    </section>
  );
}

function ImportSummary({ result }: { result: ImportResult }) {
  return (
    <section className="panel">
      <h2>Import Result</h2>
      <div className="summary-grid">
        {Object.entries(result.summary).map(([key, value]) => (
          <span key={key}>
            {key}: <strong>{value}</strong>
          </span>
        ))}
      </div>
      {result.errors.length > 0 ? (
        <ul className="clean-list warning">
          {result.errors.map((item) => (
            <li key={`${item.rowNumber}-${item.reason}`}>
              Row {item.rowNumber}: {item.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function OpportunitiesView({
  opportunities,
  selectedIds,
  setSelectedIds,
  quickFilter,
  setQuickFilter,
  runAction
}: {
  opportunities: Opportunity[];
  selectedIds: Set<string>;
  setSelectedIds: (value: Set<string>) => void;
  quickFilter: OpportunityQuickFilter;
  setQuickFilter: (value: OpportunityQuickFilter) => void;
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [band, setBand] = useState("");
  const [risk, setRisk] = useState("");
  const [method, setMethod] = useState("");
  const quickFilters = useMemo(
    () => buildQuickFilters(opportunities),
    [opportunities]
  );

  const filtered = useMemo(() => {
    return opportunities.filter((opportunity) => {
      const text = [
        opportunity.company,
        opportunity.role,
        opportunity.notes,
        opportunity.jobDescription
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesQuickFilter(opportunity, quickFilter, today()) &&
        (!search || text.includes(search.toLowerCase())) &&
        (!status || opportunity.status === status) &&
        (!band || opportunity.priorityBand === band) &&
        (!risk || opportunity.applicationRiskLevel === risk) &&
        (!method || opportunity.method === method)
      );
    });
  }, [opportunities, search, status, band, risk, method, quickFilter]);

  const selected = opportunities.filter((item) => selectedIds.has(item.id));
  const selectedWithPacks = selected.filter(hasGeneratedPack);

  function toggle(id: string) {
    const next = new Set(selectedIds);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    setSelectedIds(next);
  }

  return (
    <section className="stack">
      <div className="toolbar panel">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search company, role, notes, JD"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {pipelineColumns.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={band} onChange={(event) => setBand(event.target.value)}>
          <option value="">All bands</option>
          {priorityBands.map((item) => (
            <option key={item} value={item}>
              Band {item}
            </option>
          ))}
        </select>
        <select value={risk} onChange={(event) => setRisk(event.target.value)}>
          <option value="">All risks</option>
          <option value="low">Low risk</option>
          <option value="medium">Medium risk</option>
          <option value="high">High risk</option>
        </select>
        <select value={method} onChange={(event) => setMethod(event.target.value)}>
          <option value="">All methods</option>
          {["email", "web", "referral", "recruiter", "other"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-pills" aria-label="Fast opportunity filters">
        {quickFilters.map((item) => (
          <button
            key={item.key}
            className={quickFilter === item.key ? "active" : ""}
            onClick={() => setQuickFilter(item.key)}
          >
            {item.label} <strong>{item.count}</strong>
          </button>
        ))}
      </div>
      <div className="button-row">
        <button onClick={() => setSelectedIds(new Set(filtered.map((item) => item.id)))}>
          Select Visible
        </button>
        <button onClick={() => setSelectedIds(new Set())}>Clear</button>
        <button
          onClick={() =>
            runAction("Selected opportunities scored.", async () => {
              await apiPost("/api/score/bulk", { ids: [...selectedIds] });
            })
          }
          disabled={selectedIds.size === 0}
        >
          Score Selected Locally
        </button>
        <button
          className="primary"
          onClick={() =>
            runAction("Packs generated for selected opportunities.", async () => {
              await apiPost("/api/generate-batch", { ids: [...selectedIds] });
            })
          }
          disabled={selectedIds.size === 0}
        >
          Generate Review Packs
        </button>
        <button
          onClick={() =>
            runAction("Application kits built for selected packed opportunities.", async () => {
              for (const opportunity of selectedWithPacks) {
                await apiPost(`/api/application-kit/${opportunity.id}`, {});
              }
            })
          }
          disabled={selectedWithPacks.length === 0}
        >
          Build Kits For Selected
        </button>
        <button
          onClick={() =>
            runAction("Selected opportunities marked ignored.", async () => {
              for (const id of selectedIds) {
                await apiPost("/api/pipeline/status", { id, status: "ignored" });
              }
            })
          }
          disabled={selectedIds.size === 0}
        >
          Mark Ignored
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Opportunity</th>
              <th>Band</th>
              <th>Score</th>
              <th>Risk</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Next Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title="No opportunities match this filter"
                    body="Clear filters or import new opportunities before spending time in files."
                  />
                </td>
              </tr>
            ) : null}
            {filtered.map((opportunity) => (
              <tr key={opportunity.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(opportunity.id)}
                    onChange={() => toggle(opportunity.id)}
                    aria-label={`Select ${opportunity.company} ${opportunity.role}`}
                  />
                </td>
                <td>
                  <strong>{opportunity.company}</strong>
                  <span>{opportunity.role}</span>
                </td>
                <td>
                  <Band value={opportunity.priorityBand} />
                </td>
                <td>{opportunity.score?.strategicFitScore ?? "Unscored"}</td>
                <td>
                  <Risk value={opportunity.applicationRiskLevel} />
                </td>
                <td>{labelize(opportunity.status)}</td>
                <td>{opportunity.deadline || "None"}</td>
                <td>{opportunity.nextAction ?? opportunity.recommendedAction ?? "Decide"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ShortlistView({
  opportunities,
  selectedIds,
  runAction
}: {
  opportunities: Opportunity[];
  selectedIds: string[];
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const [shortlist, setShortlist] = useState<Opportunity[]>([]);
  const [notWorth, setNotWorth] = useState<Opportunity[]>([]);

  async function loadShortlist(top = 10, band?: PriorityBand) {
    const result = await apiPost<{
      shortlist: Opportunity[];
      notWorthTouchingToday: Opportunity[];
    }>("/api/shortlist", { top, band });
    setShortlist(result.shortlist);
    setNotWorth(result.notWorthTouchingToday);
  }

  return (
    <section className="stack">
      <section className="panel">
        <h2>Shortlist Control</h2>
        <p className="muted">
          Refresh Ranking scores missing records, ranks the day, and separates work worth touching from work to ignore.
        </p>
      </section>
      <div className="button-row">
        <button onClick={() => runAction("Shortlist refreshed.", () => loadShortlist(10))}>
          Refresh Ranking
        </button>
        <button
          onClick={() =>
            runAction("Generated packs for top 3.", async () => {
              const result = await apiPost<{
                shortlist: Opportunity[];
                notWorthTouchingToday: Opportunity[];
              }>("/api/shortlist", { top: 3 });
              setShortlist(result.shortlist);
              setNotWorth(result.notWorthTouchingToday);
              const ids = result.shortlist.slice(0, 3).map((item) => item.id);
              await apiPost("/api/generate-batch", { ids });
            })
          }
        >
          Generate Top 3 Review Packs
        </button>
        <button
          onClick={() =>
            runAction("Generated packs for top 5.", async () => {
              await apiPost("/api/generate-batch", { top: 5 });
            })
          }
        >
          Generate Top 5 Review Packs
        </button>
        <button
          onClick={() =>
            runAction("Generated packs for selected.", async () => {
              await apiPost("/api/generate-batch", { ids: selectedIds });
            })
          }
          disabled={selectedIds.length === 0}
        >
          Generate Selected Review Packs
        </button>
        <button
          className="primary"
          onClick={() =>
            runAction("Generated packs for band A.", async () => {
              await apiPost("/api/generate-batch", { band: "A" });
            })
          }
        >
          Generate Band A Review Packs
        </button>
      </div>
      <div className="band-grid">
        {priorityBands.map((band) => (
          <section className="panel" key={band}>
            <h2>Band {band}</h2>
            <OpportunityCards
              opportunities={(shortlist.length ? shortlist : opportunities).filter(
                (item) => item.priorityBand === band
              )}
              emptyText="No scored opportunities in this band yet. Refresh ranking first."
            />
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Not Worth Touching Today</h2>
        <OpportunityCards
          opportunities={notWorth}
          compact
          emptyText="Nothing has been flagged as low-value today."
        />
      </section>
    </section>
  );
}

function PackViewer({
  opportunities,
  runAction,
  copyText
}: {
  opportunities: Opportunity[];
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
  copyText: CopyText;
}) {
  const packReady = opportunities.filter((item) => item.packPath ?? item.generatedPackDir);
  const [selectedId, setSelectedId] = useState(packReady[0]?.id ?? "");
  const [pack, setPack] = useState<PackView | null>(null);
  const [tabKey, setTabKey] = useState("");
  const [notes, setNotes] = useState("");
  const [claim, setClaim] = useState("");
  const [claimReviews, setClaimReviews] = useState<
    NonNullable<PackView["reviewNotes"]>["claimReviews"]
  >([]);

  async function loadPack(id = selectedId) {
    if (!id) {
      return;
    }

    const next = await apiGet<PackView>(`/api/packs/${id}`);
    setPack(next);
    setTabKey(next.tabs[0]?.key ?? "");
    setNotes(next.reviewNotes?.notes ?? "");
    setClaimReviews(next.reviewNotes?.claimReviews ?? []);
  }

  const activeTab = pack?.tabs.find((item) => item.key === tabKey) ?? pack?.tabs[0];
  const checklist = pack?.tabs.find((item) => item.key === "checklist")?.content ?? "";
  const evidenceGaps = useMemo(() => extractChecklistItems(checklist), [checklist]);
  const unresolvedGaps = evidenceGaps.filter(
    (gap) =>
      !claimReviews.some(
        (review) => review.claim === gap && review.decision === "keep"
      )
  );

  function recordClaimDecision(
    claimText: string,
    decision: NonNullable<PackView["reviewNotes"]>["claimReviews"][number]["decision"]
  ) {
    const cleanClaim = claimText.trim();

    if (!cleanClaim) {
      return;
    }

    setClaimReviews((current) => [
      ...current.filter((item) => item.claim !== cleanClaim),
      { claim: cleanClaim, decision }
    ]);
    setClaim("");
  }

  useEffect(() => {
    if (!selectedId || pack?.opportunity.id === selectedId) {
      return;
    }

    apiGet<PackView>(`/api/packs/${selectedId}`)
      .then((next) => {
        setPack(next);
        setTabKey(next.tabs[0]?.key ?? "");
        setNotes(next.reviewNotes?.notes ?? "");
        setClaimReviews(next.reviewNotes?.claimReviews ?? []);
      })
      .catch(() => undefined);
  }, [pack?.opportunity.id, selectedId]);

  return (
    <section className="stack">
      <div className="toolbar panel">
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">Select generated pack</option>
          {packReady.map((item) => (
            <option key={item.id} value={item.id}>
              {item.company} - {item.role}
            </option>
          ))}
        </select>
        <button onClick={() => runAction("Pack loaded.", () => loadPack())}>
          Open Pack
        </button>
      </div>
      {packReady.length === 0 ? (
        <EmptyState
          title="No generated packs yet"
          body="Generate review packs from Opportunities or Shortlist before reviewing claims."
        />
      ) : null}
      {pack ? (
        <div className="two-column wide-left">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>{pack.opportunity.company}</h2>
                <p className="muted">{pack.opportunity.role}</p>
              </div>
              <Risk value={pack.opportunity.applicationRiskLevel} />
            </div>
            <div className="tabs">
              {pack.tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={activeTab?.key === tab.key ? "active" : ""}
                  onClick={() => setTabKey(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="pack-header">
              <span>{pack.directory}</span>
              <button
                onClick={() =>
                  activeTab
                    ? copyText(`${activeTab.label} section`, activeTab.content)
                    : undefined
                }
              >
                Copy Section
              </button>
            </div>
            <pre className="markdown-view">{activeTab?.content ?? "No pack file loaded."}</pre>
          </section>
          <section className="panel">
            <h2>Review Decisions</h2>
            <div className="callout warning-soft">
              <strong>{unresolvedGaps.length}</strong>
              <span>unresolved evidence gaps before kit export</span>
            </div>
            {evidenceGaps.length > 0 ? (
              <div className="decision-list">
                {evidenceGaps.map((gap) => (
                  <article key={gap}>
                    <p>{gap}</p>
                    <div className="mini-actions">
                      {claimDecisionOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => recordClaimDecision(gap, option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No checklist gaps were found in this pack. Still review every claim before sending.</p>
            )}
            <label>
              Review notes
              <textarea
                rows={9}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <label>
              Add custom claim or note
              <input
                value={claim}
                onChange={(event) => setClaim(event.target.value)}
                placeholder="Paste a claim that needs a decision"
              />
            </label>
            <div className="button-row">
              {claimDecisionOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => recordClaimDecision(claim, option.value)}
                  disabled={!claim.trim()}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="review-summary">
              {claimReviews.length === 0 ? (
                <p className="muted">No saved claim decisions yet.</p>
              ) : (
                claimReviews.map((item) => (
                  <article key={`${item.claim}-${item.decision}`}>
                    <Decision value={item.decision} />
                    <span>{item.claim}</span>
                  </article>
                ))
              )}
            </div>
            <button
              className="primary"
              onClick={() =>
                runAction("Pack review decisions saved.", async () => {
                  await apiPost(`/api/packs/${pack.opportunity.id}/review-notes`, {
                    notes,
                    claimReviews
                  });
                  await loadPack(pack.opportunity.id);
                })
              }
            >
              Save Review Decisions
            </button>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function PipelineView({
  opportunities,
  runAction
}: {
  opportunities: Opportunity[];
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  return (
    <section className="kanban">
      {pipelineColumns.map((status) => {
        const columnItems = opportunities.filter((item) => item.status === status);

        return (
          <div className="kanban-column" key={status}>
            <h2>{labelize(status)}</h2>
            {columnItems.length === 0 ? (
              <p className="muted compact-note">Empty</p>
            ) : null}
            {columnItems.map((opportunity) => (
              <PipelineCard
                key={opportunity.id}
                opportunity={opportunity}
                runAction={runAction}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}

function PipelineCard({
  opportunity,
  runAction
}: {
  opportunity: Opportunity;
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const [nextAction, setNextAction] = useState(opportunity.nextAction ?? "");
  const [followUpDate, setFollowUpDate] = useState(opportunity.followUpDate ?? "");

  return (
    <article className="op-card">
      <strong>{opportunity.company}</strong>
      <span>{opportunity.role}</span>
      <Band value={opportunity.priorityBand} />
      <div className="mini-actions">
        {["applied", "follow_up_due", "interview", "rejected", "ignored"].map(
          (status) => (
            <button
              key={status}
              onClick={() =>
                runAction(`Marked ${opportunity.company} as ${status}.`, async () => {
                  await apiPost("/api/pipeline/status", {
                    id: opportunity.id,
                    status
                  });
                })
              }
            >
              {labelize(status)}
            </button>
          )
        )}
      </div>
      <input
        value={nextAction}
        onChange={(event) => setNextAction(event.target.value)}
        placeholder="Next action"
      />
      <button
        onClick={() =>
          runAction("Next action saved.", async () => {
            await apiPost("/api/pipeline/next", {
              id: opportunity.id,
              nextAction
            });
          })
        }
      >
        Save Next
      </button>
      <input
        type="date"
        value={followUpDate}
        onChange={(event) => setFollowUpDate(event.target.value)}
      />
      <button
        onClick={() =>
          runAction("Follow-up date saved.", async () => {
            await apiPost("/api/pipeline/followup", {
              id: opportunity.id,
              followUpDate
            });
          })
        }
      >
        Save Follow-Up
      </button>
    </article>
  );
}

function ResumeLibrary({
  resumes,
  runAction
}: {
  resumes: ResumeVersion[];
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: "",
    targetLane: "",
    industries: "",
    seniority: "",
    language: "English",
    filePath: "",
    notes: "",
    isPreferred: false
  });

  return (
    <section className="two-column">
      <div className="panel">
        <div className="section-heading">
          <div>
            <h2>Quick Register Resume Version</h2>
            <p className="muted">Manual metadata only. PDF parsing and auto-match are not enabled yet.</p>
          </div>
        </div>
        <label>
          Title
          <input
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Kaze - Automation / Implementation Resume"
          />
        </label>
        <label>
          Target lane
          <input
            value={form.targetLane}
            onChange={(event) =>
              setForm((current) => ({ ...current, targetLane: event.target.value }))
            }
            placeholder="automation, implementation, operations"
          />
        </label>
        <label>
          Industries
          <input
            value={form.industries}
            onChange={(event) =>
              setForm((current) => ({ ...current, industries: event.target.value }))
            }
            placeholder="technology, sustainability, fintech"
          />
        </label>
        <div className="form-row">
          <label>
            Seniority
            <input
              value={form.seniority}
              onChange={(event) =>
                setForm((current) => ({ ...current, seniority: event.target.value }))
              }
              placeholder="mid, senior, consultant"
            />
          </label>
          <label>
            Language
            <input
              value={form.language}
              onChange={(event) =>
                setForm((current) => ({ ...current, language: event.target.value }))
              }
            />
          </label>
        </div>
        <label>
          File path
          <input
            value={form.filePath}
            onChange={(event) =>
              setForm((current) => ({ ...current, filePath: event.target.value }))
            }
            placeholder="C:\\Users\\PC\\Documents\\Resumes\\kaze-automation.pdf"
          />
        </label>
        <label>
          Notes
          <input
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            placeholder="Use for automation-heavy roles"
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.isPreferred}
            onChange={(event) =>
              setForm((current) => ({ ...current, isPreferred: event.target.checked }))
            }
          />
          Make this the manually selected default resume
        </label>
        <button
          className="primary"
          disabled={!form.title.trim() || !form.filePath.trim()}
          onClick={() =>
            runAction("Resume version registered.", async () => {
              await apiPost("/api/resumes", {
                ...form,
                industries: form.industries
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
                isPreferred: form.isPreferred
              });
              setForm({
                title: "",
                targetLane: "",
                industries: "",
                seniority: "",
                language: "English",
                filePath: "",
                notes: "",
                isPreferred: false
              });
            })
          }
        >
          Register
        </button>
      </div>
      <div className="panel">
        <h2>Local Resume Versions</h2>
        {resumes.length === 0 ? (
          <EmptyState
            title="No resume versions registered"
            body="Add a local path reference so kit export can tell Kaze exactly which resume to attach."
          />
        ) : (
          <div className="card-list compact">
            {resumes.map((resume) => (
              <article className="op-card" key={resume.id}>
                <strong>{resume.title}</strong>
                <span>{resume.targetLane || "No lane"} - {resume.language}</span>
                <p className="path">{resume.filePath}</p>
                <div className="meta-row">
                  {resume.isPreferred ? <span className="status-pill">Default</span> : null}
                  <span>{resume.industries.join(", ") || "No industries"}</span>
                </div>
                {resume.notes ? <p>{resume.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function KitBuilder({
  opportunities,
  resumes,
  runAction,
  copyText
}: {
  opportunities: Opportunity[];
  resumes: ResumeVersion[];
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
  copyText: CopyText;
}) {
  const [opportunityId, setOpportunityId] = useState(opportunities[0]?.id ?? "");
  const [resumeId, setResumeId] = useState("");
  const [notes, setNotes] = useState("");
  const [pack, setPack] = useState<PackView | null>(null);
  const [packError, setPackError] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [kit, setKit] = useState<ApplicationKitView | null>(null);
  const selectedOpportunity = opportunities.find((item) => item.id === opportunityId);
  const selectedResume = resumes.find((resume) => resume.id === resumeId);
  const preferredResume = resumes.find((resume) => resume.isPreferred);
  const laneResume = selectedOpportunity
    ? resumes.find((resume) =>
        Boolean(resume.targetLane.trim()) &&
        selectedOpportunity.role
          .toLowerCase()
          .includes(resume.targetLane.toLowerCase())
      )
    : undefined;
  const recommendedResume = preferredResume ?? laneResume;
  const checklistTab = pack?.tabs.find((item) => item.key === "checklist");
  const packClaimWarnings = [
    ...extractChecklistItems(checklistTab?.content ?? ""),
    ...(pack?.reviewNotes?.claimReviews ?? [])
      .filter((item) => item.decision !== "keep")
      .map((item) => `${labelize(item.decision)}: ${item.claim}`)
  ];
  const finalChecklist = [
    "resume selected",
    "cover letter reviewed",
    "claims verified",
    "application URL opened",
    "status updated after submission"
  ];

  useEffect(() => {
    const opportunity = opportunities.find((item) => item.id === opportunityId);

    setKit(null);
    setPack(null);
    setPackError("");

    if (!opportunity || !hasGeneratedPack(opportunity)) {
      return;
    }

    apiGet<PackView>(`/api/packs/${opportunity.id}`)
      .then(setPack)
      .catch((caught) =>
        setPackError(caught instanceof Error ? caught.message : String(caught))
      );
  }, [opportunities, opportunityId]);

  return (
    <section className="stack">
      <div className="panel">
        <div className="section-heading">
          <div>
            <h2>Application Kit Builder</h2>
            <p className="muted">Create the local folder Kaze can copy from after manual review.</p>
          </div>
          {selectedOpportunity?.url ? (
            <a className="button-link" href={selectedOpportunity.url} target="_blank" rel="noreferrer">
              Open Application URL
            </a>
          ) : null}
        </div>
        <div className="form-row">
          <label>
            Opportunity
            <select
              value={opportunityId}
              onChange={(event) => setOpportunityId(event.target.value)}
            >
              {opportunities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.company} - {item.role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Resume
            <select value={resumeId} onChange={(event) => setResumeId(event.target.value)}>
              <option value="">No resume selected</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {recommendedResume && !resumeId ? (
          <div className="callout">
            <span>Recommended resume reference</span>
            <strong>{recommendedResume.title}</strong>
            <button onClick={() => setResumeId(recommendedResume.id)}>
              Use This Resume
            </button>
          </div>
        ) : null}
        <label>
          Application notes
          <textarea
            rows={6}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        {selectedOpportunity ? (
          <div className="summary-grid">
            <span>Status: <strong>{labelize(selectedOpportunity.status)}</strong></span>
            <span>Pack: <strong>{hasGeneratedPack(selectedOpportunity) ? "ready" : "missing"}</strong></span>
            <span>Kit: <strong>{selectedOpportunity.applicationKitDir ? "built" : "not built"}</strong></span>
            <span>Risk: <strong>{selectedOpportunity.applicationRiskLevel ?? "unknown"}</strong></span>
          </div>
        ) : null}
        <button
          className="primary"
          disabled={!opportunityId}
          onClick={() =>
            runAction("Application kit created.", async () => {
              const result = await apiPost<ApplicationKitView>(`/api/application-kit/${opportunityId}`, {
                resumeVersionId: resumeId || undefined,
                applicationNotes: notes
              });
              setKit(result);
            })
          }
        >
          Create Local Application Kit
        </button>
      </div>
      <div className="two-column">
        <section className="panel">
          <h2>Selected Resume Reference</h2>
          {selectedResume ? (
            <div className="stack tight">
              <strong>{selectedResume.title}</strong>
              <span>{selectedResume.targetLane || "No lane"} - {selectedResume.language}</span>
              <p className="path">{selectedResume.filePath}</p>
            </div>
          ) : (
            <EmptyState
              title="No resume selected"
              body="Select a resume before final submission. Kit export can still draft material, but the checklist will remain incomplete."
            />
          )}
          <p className="muted">Future auto-match is not enabled yet. Use the preferred or lane-specific resume manually.</p>
        </section>
        <section className="panel">
          <h2>Claims To Verify Before Submitting</h2>
          {packError ? <div className="notice error">{packError}</div> : null}
          {packClaimWarnings.length === 0 ? (
            <p className="muted">No generated checklist warnings found. Still review the pack manually.</p>
          ) : (
            <ul className="clean-list warning">
              {packClaimWarnings.slice(0, 8).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>Final Submission Checklist</h2>
        <div className="checklist-grid">
          {finalChecklist.map((item) => (
            <label className="check-row" key={item}>
              <input
                type="checkbox"
                checked={checklist[item] ?? false}
                onChange={(event) =>
                  setChecklist((current) => ({
                    ...current,
                    [item]: event.target.checked
                  }))
                }
              />
              {labelize(item)}
            </label>
          ))}
        </div>
      </section>
      {kit ? (
        <div className="two-column">
          <section className="panel">
            <h2>Final Output Ready</h2>
            <p className="path">{kit.directory}</p>
            {kit.selectedResume ? (
              <div className="callout">
                <span>Resume selected</span>
                <strong>{kit.selectedResume.title}</strong>
                <p className="path">{kit.selectedResume.filePath}</p>
              </div>
            ) : null}
            <ul className="clean-list">
              {kit.files.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>Copy-Ready Fields</h2>
            {copyFieldOrder
              .filter((key) => kit.copyFields[key])
              .map((key) => [key, kit.copyFields[key]] as const)
              .map(([key, value]) => (
              <div className="copy-field" key={key}>
                <span>{labelize(key)}</span>
                <button onClick={() => copyText(labelize(key), value)}>
                  Copy
                </button>
                <p>{value}</p>
              </div>
            ))}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function SettingsView({
  settings,
  runAction
}: {
  settings: OperatorSettings;
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);

  return (
    <section className="stack">
      <div className="panel">
        <div className="form-row">
          <label>
            Provider mode
            <select
              value={draft.aiProviderMode}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  aiProviderMode: event.target.value as OperatorSettings["aiProviderMode"]
                })
              }
            >
              <option value="mock">mock</option>
              <option value="openrouter">openrouter</option>
              <option value="gemini">gemini</option>
            </select>
          </label>
          <label>
            Max requests per batch
            <input
              type="number"
              min={1}
              value={draft.costSafety.maxRequestsPerBatch}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  costSafety: {
                    ...draft.costSafety,
                    maxRequestsPerBatch: Number(event.target.value)
                  }
                })
              }
            />
          </label>
          <label>
            Max opportunities per run
            <input
              type="number"
              min={1}
              value={draft.costSafety.maxOpportunitiesPerRun}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  costSafety: {
                    ...draft.costSafety,
                    maxOpportunitiesPerRun: Number(event.target.value)
                  }
                })
              }
            />
          </label>
        </div>
        <div className="flag-grid">
          {Object.entries(draft.featureFlags).map(([key, value]) => (
            <label className="check-row" key={key}>
              <input
                type="checkbox"
                checked={value}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    featureFlags: {
                      ...draft.featureFlags,
                      [key]: event.target.checked
                    }
                  })
                }
              />
              {labelize(key)}
            </label>
          ))}
        </div>
        <button
          className="primary"
          onClick={() =>
            runAction("Settings saved locally.", async () => {
              await apiPost("/api/settings", draft);
            })
          }
        >
          Save Settings
        </button>
      </div>
      <div className="connector-grid">
        {Object.values(draft.connectors).map((connector) => (
          <section className="panel" key={connector.name}>
            <h2>{labelize(connector.name)}</h2>
            <div className="summary-grid">
              <span>Enabled: {connector.enabled ? "yes" : "no"}</span>
              <span>Configured: {connector.configured ? "yes" : "no"}</span>
            </div>
            <p>{connector.privacyWarning}</p>
            <p>{connector.setupHint}</p>
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Local Config Placeholders</h2>
        <ul className="clean-list">
          {Object.entries(draft.localConfigPlaceholders).map(([key, value]) => (
            <li key={key}>
              <strong>{labelize(key)}</strong>
              <span>{value}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function OpportunityCards({
  opportunities,
  compact = false,
  emptyText = "None"
}: {
  opportunities: Opportunity[];
  compact?: boolean;
  emptyText?: string;
}) {
  if (opportunities.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className={compact ? "card-list compact" : "card-list"}>
      {opportunities.map((opportunity) => (
        <article className="op-card" key={opportunity.id}>
          <strong>{opportunity.company}</strong>
          <span>{opportunity.role}</span>
          <div className="meta-row">
            <Band value={opportunity.priorityBand} />
            <Risk value={opportunity.applicationRiskLevel} />
            <span>{labelize(opportunity.status)}</span>
          </div>
          {!compact ? <p>{opportunity.nextAction ?? opportunity.recommendedAction}</p> : null}
        </article>
      ))}
    </div>
  );
}

const claimDecisionOptions: Array<{
  value: "keep" | "edit" | "remove" | "evidence-needed";
  label: string;
}> = [
  { value: "keep", label: "Keep" },
  { value: "edit", label: "Edit" },
  { value: "remove", label: "Remove" },
  { value: "evidence-needed", label: "Evidence Needed" }
];

const copyFieldOrder = [
  "candidateSummary",
  "motivationParagraph",
  "relevantExperienceParagraph",
  "coverEmail",
  "referralMessage",
  "formAnswerCheatSheet",
  "salaryExpectation",
  "availability",
  "referralContactNotes"
];

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </section>
  );
}

function Decision({
  value
}: {
  value: "keep" | "edit" | "remove" | "evidence-needed";
}) {
  return <span className={`decision decision-${value}`}>{labelize(value)}</span>;
}

function Band({ value }: { value?: PriorityBand }) {
  return <span className={`band band-${value ?? "none"}`}>{value ?? "-"}</span>;
}

function Risk({ value }: { value?: Opportunity["applicationRiskLevel"] }) {
  return <span className={`risk risk-${value ?? "unknown"}`}>{value ?? "unknown"}</span>;
}

function buildQuickFilters(opportunities: Opportunity[]) {
  const keys: Array<{ key: OpportunityQuickFilter; label: string }> = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "unscored", label: "Unscored" },
    { key: "apply-today", label: "Apply Today" },
    { key: "high-fit", label: "High Fit" },
    { key: "low-risk", label: "Low Risk" },
    { key: "remote-global", label: "Remote/Global" },
    { key: "deadline-soon", label: "Deadline Soon" },
    { key: "packs-review", label: "Packs To Review" },
    { key: "kits-ready", label: "Kits Ready" },
    { key: "follow-ups-due", label: "Follow-Ups" },
    { key: "stale", label: "Stale" },
    { key: "not-worth-touching", label: "Not Worth Touching" }
  ];

  return keys.map((item) => ({
    ...item,
    count: opportunities.filter((opportunity) =>
      matchesQuickFilter(opportunity, item.key, today())
    ).length
  }));
}

function matchesQuickFilter(
  opportunity: Opportunity,
  filter: OpportunityQuickFilter,
  date: string
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "new") {
    return isActiveOpportunity(opportunity) && ["new", "captured"].includes(opportunity.status);
  }

  if (filter === "unscored") {
    return isActiveOpportunity(opportunity) && !opportunity.score;
  }

  if (filter === "apply-today") {
    return (
      isActiveOpportunity(opportunity) &&
      (Boolean(opportunity.applicationKitDir) ||
        opportunity.status === "review_ready" ||
        (["A", "B"].includes(opportunity.priorityBand ?? "") &&
          opportunity.applicationRiskLevel !== "high"))
    );
  }

  if (filter === "high-fit") {
    return (
      isActiveOpportunity(opportunity) &&
      (["A", "B"].includes(opportunity.priorityBand ?? "") ||
        (opportunity.score?.strategicFitScore ?? 0) >= 75)
    );
  }

  if (filter === "low-risk") {
    return isActiveOpportunity(opportunity) && opportunity.applicationRiskLevel === "low";
  }

  if (filter === "remote-global") {
    return isActiveOpportunity(opportunity) && hasRemoteSignal(opportunity);
  }

  if (filter === "deadline-soon") {
    return isActiveOpportunity(opportunity) && isUrgentDeadline(opportunity.deadline, date);
  }

  if (filter === "packs-review") {
    return isActiveOpportunity(opportunity) && hasGeneratedPack(opportunity);
  }

  if (filter === "kits-ready") {
    return isActiveOpportunity(opportunity) && Boolean(opportunity.applicationKitDir);
  }

  if (filter === "follow-ups-due") {
    return isFollowUpDue(opportunity, date);
  }

  if (filter === "stale") {
    return isStaleOpportunity(opportunity, date);
  }

  return (
    opportunity.status === "ignored" ||
    opportunity.priorityBand === "D" ||
    opportunity.applicationRiskLevel === "high" ||
    opportunity.score?.decision === "Ignore"
  );
}

function hasGeneratedPack(opportunity: Opportunity): boolean {
  return Boolean(opportunity.packPath ?? opportunity.generatedPackDir);
}

function isActiveOpportunity(opportunity: Opportunity): boolean {
  return !["closed", "rejected", "ignored"].includes(opportunity.status);
}

function isFollowUpDue(opportunity: Opportunity, date: string): boolean {
  return (
    Boolean(opportunity.followUpDate && opportunity.followUpDate <= date) ||
    opportunity.status === "follow_up_due" ||
    opportunity.status === "follow_up"
  );
}

function isStaleOpportunity(opportunity: Opportunity, date: string): boolean {
  return (
    isActiveOpportunity(opportunity) &&
    Boolean(opportunity.lastUpdated) &&
    daysBetween(opportunity.lastUpdated?.slice(0, 10) ?? date, date) >= 14
  );
}

function isUrgentDeadline(deadline: string, date: string): boolean {
  if (!deadline) {
    return false;
  }

  const days = daysBetween(date, deadline);

  return days >= 0 && days <= 7;
}

function hasRemoteSignal(opportunity: Opportunity): boolean {
  const text = [
    opportunity.remote,
    opportunity.location,
    opportunity.notes,
    opportunity.jobDescription
  ]
    .join(" ")
    .toLowerCase();

  return ["remote", "global", "worldwide", "anywhere", "distributed"].some((term) =>
    text.includes(term)
  );
}

function extractChecklistItems(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^- \[[ x]\]\s+(.+)$/i)?.[1] ?? "")
    .map((line) => line.trim())
    .filter(Boolean);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }

  return Math.floor((end - start) / 86_400_000);
}

function labelize(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}
