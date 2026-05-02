import { useEffect, useMemo, useState } from "react";
import {
  apiGet,
  apiPost,
  type ActionLogEntry,
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

    try {
      await action();
      await refresh();
      setMessage(label);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  useEffect(() => {
    refresh().catch((caught) =>
      setError(caught instanceof Error ? caught.message : String(caught))
    );
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
            <button onClick={() => runAction("Refreshed local state.", refresh)}>
              Refresh
            </button>
            <button
              className="primary"
              onClick={() => setView("opportunities")}
            >
              Review Queue
            </button>
          </div>
        </header>

        {message ? <div className="notice success">{message}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}

        {view === "dashboard" && data ? (
          <Dashboard data={data} actionLog={actionLog} />
        ) : null}
        {view === "import" ? (
          <ImportView runAction={runAction} />
        ) : null}
        {view === "opportunities" ? (
          <OpportunitiesView
            opportunities={opportunities}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
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
          <PackViewer opportunities={opportunities} runAction={runAction} />
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
  actionLog
}: {
  data: OpportunityListResponse;
  actionLog: ActionLogEntry[];
}) {
  const stats = [
    ["Total", data.summary.total],
    ["Band A", data.summary.priorityBands.A],
    ["Band B", data.summary.priorityBands.B],
    ["Urgent", data.summary.urgentDeadlines],
    ["Review-ready", data.summary.reviewReadyPacks],
    ["Follow-ups", data.summary.followUpsDue]
  ];

  return (
    <section className="stack">
      <div className="metric-grid">
        {stats.map(([label, value]) => (
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
  runAction
}: {
  opportunities: Opportunity[];
  selectedIds: Set<string>;
  setSelectedIds: (value: Set<string>) => void;
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [band, setBand] = useState("");
  const [risk, setRisk] = useState("");
  const [method, setMethod] = useState("");

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
        (!search || text.includes(search.toLowerCase())) &&
        (!status || opportunity.status === status) &&
        (!band || opportunity.priorityBand === band) &&
        (!risk || opportunity.applicationRiskLevel === risk) &&
        (!method || opportunity.method === method)
      );
    });
  }, [opportunities, search, status, band, risk, method]);

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
          Score Selected
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
          Generate Packs
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
                <td>{opportunity.status}</td>
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
          Generate Top 3
        </button>
        <button
          onClick={() =>
            runAction("Generated packs for top 5.", async () => {
              await apiPost("/api/generate-batch", { top: 5 });
            })
          }
        >
          Generate Top 5
        </button>
        <button
          onClick={() =>
            runAction("Generated packs for selected.", async () => {
              await apiPost("/api/generate-batch", { ids: selectedIds });
            })
          }
          disabled={selectedIds.length === 0}
        >
          Generate Selected
        </button>
        <button
          className="primary"
          onClick={() =>
            runAction("Generated packs for band A.", async () => {
              await apiPost("/api/generate-batch", { band: "A" });
            })
          }
        >
          Generate Band A
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
            />
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Not Worth Touching Today</h2>
        <OpportunityCards opportunities={notWorth} compact />
      </section>
    </section>
  );
}

function PackViewer({
  opportunities,
  runAction
}: {
  opportunities: Opportunity[];
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const packReady = opportunities.filter((item) => item.packPath ?? item.generatedPackDir);
  const [selectedId, setSelectedId] = useState(packReady[0]?.id ?? "");
  const [pack, setPack] = useState<PackView | null>(null);
  const [tabKey, setTabKey] = useState("");
  const [notes, setNotes] = useState("");
  const [claim, setClaim] = useState("");
  const [decision, setDecision] = useState("keep");

  async function loadPack(id = selectedId) {
    if (!id) {
      return;
    }

    const next = await apiGet<PackView>(`/api/packs/${id}`);
    setPack(next);
    setTabKey(next.tabs[0]?.key ?? "");
    setNotes(next.reviewNotes?.notes ?? "");
  }

  const activeTab = pack?.tabs.find((item) => item.key === tabKey) ?? pack?.tabs[0];

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
      {pack ? (
        <div className="two-column wide-left">
          <section className="panel">
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
                onClick={() => {
                  if (activeTab) {
                    void navigator.clipboard.writeText(activeTab.content);
                  }
                }}
              >
                Copy Section
              </button>
            </div>
            <pre className="markdown-view">{activeTab?.content ?? "No pack file loaded."}</pre>
          </section>
          <section className="panel">
            <h2>Manual Review</h2>
            <label>
              Review notes
              <textarea
                rows={9}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <label>
              Claim
              <input value={claim} onChange={(event) => setClaim(event.target.value)} />
            </label>
            <label>
              Decision
              <select
                value={decision}
                onChange={(event) => setDecision(event.target.value)}
              >
                <option value="keep">keep</option>
                <option value="edit">edit</option>
                <option value="remove">remove</option>
                <option value="evidence-needed">evidence-needed</option>
              </select>
            </label>
            <button
              className="primary"
              onClick={() =>
                runAction("Pack review notes saved.", async () => {
                  await apiPost(`/api/packs/${pack.opportunity.id}/review-notes`, {
                    notes,
                    claimReviews: claim
                      ? [{ claim, decision }]
                      : pack.reviewNotes?.claimReviews ?? []
                  });
                  await loadPack(pack.opportunity.id);
                })
              }
            >
              Save Notes
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
      {pipelineColumns.map((status) => (
        <div className="kanban-column" key={status}>
          <h2>{status}</h2>
          {opportunities
            .filter((item) => item.status === status)
            .map((opportunity) => (
              <PipelineCard
                key={opportunity.id}
                opportunity={opportunity}
                runAction={runAction}
              />
            ))}
        </div>
      ))}
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
              {status}
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
    notes: ""
  });

  return (
    <section className="two-column">
      <div className="panel">
        <h2>Register Resume Version</h2>
        {Object.entries(form).map(([key, value]) => (
          <label key={key}>
            {labelize(key)}
            <input
              value={value}
              onChange={(event) =>
                setForm((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          </label>
        ))}
        <button
          className="primary"
          onClick={() =>
            runAction("Resume version registered.", async () => {
              await apiPost("/api/resumes", {
                ...form,
                industries: form.industries
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              });
            })
          }
        >
          Register
        </button>
      </div>
      <div className="panel">
        <h2>Local Resume Versions</h2>
        <OpportunityCards
          opportunities={resumes.map((resume) => ({
            id: resume.id,
            company: resume.title,
            role: `${resume.targetLane || "No lane"} - ${resume.language}`,
            source: resume.filePath,
            url: "",
            deadline: "",
            method: "manual",
            status: resume.isPreferred ? "preferred" : "registered",
            notes: resume.notes,
            jobDescription: ""
          }))}
          compact
        />
      </div>
    </section>
  );
}

function KitBuilder({
  opportunities,
  resumes,
  runAction
}: {
  opportunities: Opportunity[];
  resumes: ResumeVersion[];
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}) {
  const [opportunityId, setOpportunityId] = useState(opportunities[0]?.id ?? "");
  const [resumeId, setResumeId] = useState("");
  const [notes, setNotes] = useState("");
  const [kit, setKit] = useState<{
    directory: string;
    files: string[];
    copyFields: Record<string, string>;
  } | null>(null);

  return (
    <section className="stack">
      <div className="panel">
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
        <label>
          Application notes
          <textarea
            rows={6}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <button
          className="primary"
          disabled={!opportunityId}
          onClick={() =>
            runAction("Application kit created.", async () => {
              const result = await apiPost<{
                directory: string;
                files: string[];
                copyFields: Record<string, string>;
              }>(`/api/application-kit/${opportunityId}`, {
                resumeVersionId: resumeId || undefined,
                applicationNotes: notes
              });
              setKit(result);
            })
          }
        >
          Create Kit
        </button>
      </div>
      {kit ? (
        <div className="two-column">
          <section className="panel">
            <h2>Kit Folder</h2>
            <p className="path">{kit.directory}</p>
            <ul className="clean-list">
              {kit.files.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>Copy Fields</h2>
            {Object.entries(kit.copyFields).map(([key, value]) => (
              <div className="copy-field" key={key}>
                <span>{labelize(key)}</span>
                <button onClick={() => void navigator.clipboard.writeText(value)}>
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
  compact = false
}: {
  opportunities: Opportunity[];
  compact?: boolean;
}) {
  if (opportunities.length === 0) {
    return <p className="muted">None</p>;
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
            <span>{opportunity.status}</span>
          </div>
          {!compact ? <p>{opportunity.nextAction ?? opportunity.recommendedAction}</p> : null}
        </article>
      ))}
    </div>
  );
}

function Band({ value }: { value?: PriorityBand }) {
  return <span className={`band band-${value ?? "none"}`}>{value ?? "-"}</span>;
}

function Risk({ value }: { value?: Opportunity["applicationRiskLevel"] }) {
  return <span className={`risk risk-${value ?? "unknown"}`}>{value ?? "unknown"}</span>;
}

function labelize(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}
