import { afterEach, describe, expect, it, vi } from "vitest";
import { agentSummaryRows, complianceRows, engagementsToRows, exportCSV, printReport } from "./export";
import { DEFAULT_CATEGORIES, DEFAULT_PHRASES } from "./checklist";
import { makeRecord } from "../test/factories";

afterEach(() => {
  vi.restoreAllMocks();
});

/** jsdom's Blob has no text(); read it through FileReader instead. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Captures the CSV text handed to the browser download. */
async function captureDownload(run: () => void): Promise<{ text: string; filename: string; mime: string }> {
  let blob: Blob | null = null;
  vi.spyOn(URL, "createObjectURL").mockImplementation((source: Blob | MediaSource) => {
    blob = source as Blob;
    return "blob:mock";
  });
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const anchor = document.createElement("a");
  const click = vi.spyOn(anchor, "click").mockImplementation(() => {});
  vi.spyOn(document, "createElement").mockReturnValue(anchor);
  run();
  expect(click).toHaveBeenCalledOnce();
  expect(revoke).toHaveBeenCalledWith("blob:mock");
  if (!blob) throw new Error("no blob was created");
  const captured: Blob = blob;
  return { text: await readBlob(captured), filename: anchor.download, mime: captured.type };
}

describe("exportCSV", () => {
  it("writes a header row followed by rows in key order", async () => {
    const { text, filename, mime } = await captureDownload(() =>
      exportCSV("report.csv", ["Agent", "Score"], [{ agent: "Thandi", score: 88 }], ["agent", "score"]),
    );
    expect(text).toBe("Agent,Score\nThandi,88");
    expect(filename).toBe("report.csv");
    expect(mime).toBe("text/csv;charset=utf-8");
  });

  it("quotes commas, quotes and newlines", async () => {
    const { text } = await captureDownload(() =>
      exportCSV("r.csv", ["a"], [{ a: 'Nkosi, T said "hi"\nagain' }], ["a"]),
    );
    expect(text).toBe('a\n"Nkosi, T said ""hi""\nagain"');
  });

  it("neutralises spreadsheet formula injection", async () => {
    const { text } = await captureDownload(() =>
      exportCSV("r.csv", ["a", "b", "c", "d"], [{ a: "=1+1", b: "+1", c: "-1", d: "@x" }], ["a", "b", "c", "d"]),
    );
    expect(text).toBe("a,b,c,d\n'=1+1,'+1,'-1,'@x");
  });

  it("renders missing values as empty cells", async () => {
    const { text } = await captureDownload(() => exportCSV("r.csv", ["a", "b"], [{ a: "x" }], ["a", "b"]));
    expect(text).toBe("a,b\nx,");
  });
});

describe("engagementsToRows", () => {
  it("maps a record to a row with phrase text for checked and missed steps", () => {
    const record = makeRecord({
      completed: 1,
      score: 45,
      pulseCompleted: true,
      dropped: false,
      checkedItems: ["p-greeting"],
      missedItems: ["p-recap", "Greeting"],
    });
    const { headers, keys, rows } = engagementsToRows([record], DEFAULT_PHRASES, DEFAULT_CATEGORIES);
    expect(headers).toHaveLength(keys.length);
    expect(rows[0]).toMatchObject({
      userName: "Thandi Nkosi",
      score: 45,
      corrected: "",
      pulseCompleted: "Yes",
      dropped: "No",
      status: "active",
    });
    expect(rows[0].checkedItems).toBe(DEFAULT_PHRASES[0].text);
    // legacy category names resolve to phrase text too
    expect(String(rows[0].missedItems).split("; ")).toHaveLength(2);
  });

  it("reports the corrected score when a manager adjusted it", () => {
    const record = makeRecord({
      score: 40,
      corrected: { by: "Manager", at: 1, oldScore: 40, newScore: 82, reason: "dispute" },
    });
    const { rows } = engagementsToRows([record], DEFAULT_PHRASES, DEFAULT_CATEGORIES);
    expect(rows[0].corrected).toBe(82);
  });

  it("keeps unresolvable item ids as-is", () => {
    const { rows } = engagementsToRows(
      [makeRecord({ checkedItems: ["ghost"] })],
      DEFAULT_PHRASES,
      DEFAULT_CATEGORIES,
    );
    expect(rows[0].checkedItems).toBe("ghost");
  });
});

describe("agentSummaryRows", () => {
  it("aggregates per agent and team, sorted by average score", () => {
    const records = [
      makeRecord({ userName: "Thandi Nkosi", team: "CCS01", score: 60, pulseCompleted: true }),
      makeRecord({ userName: "Thandi Nkosi", team: "CCS01", score: 80, dropped: true }),
      makeRecord({ userName: "Priya Naidoo", team: "CCS02", score: 90, pulseCompleted: true }),
    ];
    const { rows } = agentSummaryRows(records);
    expect(rows.map((r) => r.agent)).toEqual(["Priya Naidoo", "Thandi Nkosi"]);
    expect(rows[1]).toMatchObject({
      team: "CCS01",
      engagements: 2,
      avgScore: 70,
      best: 80,
      worst: 60,
      pulseRate: 50,
      dropped: 1,
      lastReview: "Never",
    });
  });

  it("uses corrected scores and reports the latest review date", () => {
    const records = [
      makeRecord({
        score: 40,
        corrected: { by: "Manager", at: 1, oldScore: 40, newScore: 90, reason: "dispute" },
        reviewed: { by: "Leader", at: Date.UTC(2024, 0, 2), note: "good" },
      }),
      makeRecord({ score: 90, reviewed: { by: "Leader", at: Date.UTC(2024, 0, 5), note: "better" } }),
    ];
    const { rows } = agentSummaryRows(records);
    expect(rows[0].avgScore).toBe(90);
    expect(rows[0].lastReview).toBe(new Date(Date.UTC(2024, 0, 5)).toLocaleDateString("en-ZA"));
  });

  it("returns no rows for no records", () => {
    expect(agentSummaryRows([]).rows).toEqual([]);
  });
});

describe("complianceRows", () => {
  it("scores the mandatory steps per engagement", () => {
    const record = makeRecord({
      checkedItems: ["p-verification", "p-greeting"],
      missedItems: ["p-recap"],
    });
    const { rows } = complianceRows([record], DEFAULT_PHRASES, DEFAULT_CATEGORIES);
    expect(rows[0]).toMatchObject({
      agent: "Thandi Nkosi",
      date: "2024-01-01",
      complianceScore: 50,
      compliant: "p-verification",
      nonCompliant: "p-recap",
    });
  });

  it("leaves the score blank when no compliance step was attempted", () => {
    const { rows } = complianceRows(
      [makeRecord({ checkedItems: ["p-greeting"] })],
      DEFAULT_PHRASES,
      DEFAULT_CATEGORIES,
    );
    expect(rows[0].complianceScore).toBe("");
  });
});

describe("printReport", () => {
  it("writes an escaped report document and closes it", () => {
    const doc = { write: vi.fn(), close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue({ document: doc } as unknown as Window);
    printReport("Q<A> Report", "CCS01 & CCS02", [
      { heading: "Engagements", headers: ["Agent"], rows: [["Thandi <b>"]] },
    ]);
    const html = doc.write.mock.calls[0][0] as string;
    expect(html).toContain("<title>Q&lt;A&gt; Report</title>");
    expect(html).toContain("CCS01 &amp; CCS02");
    expect(html).toContain("<td>Thandi &lt;b&gt;</td>");
    expect(html).toContain("<th>Agent</th>");
    expect(doc.close).toHaveBeenCalledOnce();
  });

  it("does nothing when the popup is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(() => printReport("t", "s", [])).not.toThrow();
  });
});
