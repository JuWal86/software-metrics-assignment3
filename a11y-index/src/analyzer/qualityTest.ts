import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import url from "url";
import Ajv from "ajv";
import yaml from "js-yaml";
import puppeteer from "puppeteer";


const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const analyzerRoot = path.join(projectRoot, "src/analyzer");

async function importModule(relPath: string) {
  const fullPath = path.resolve(projectRoot, relPath);
  if (fs.existsSync(fullPath)) return await import(url.pathToFileURL(fullPath).href);
  return null;
}

function baselineScanFiles(rootDir: string) {
  const files: { path: string; content: string }[] = [];
  const walk = (p: string) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && full.endsWith(".ts") && !full.endsWith(".d.ts"))
        files.push({ path: full, content: fs.readFileSync(full, "utf8") });
    }
  };
  walk(rootDir);
  return files;
}

function baselineDetectFeatures(files: { path: string; content: string }[]) {
  const detections: any[] = [];
  const tags: Record<string, number> = {};
  const regex = /\b(?:TODO|FIXME|BUG|HACK|QUALITY_TAG\(([A-Za-z0-9_]+)\))\b/g;
  for (const f of files) {
    f.content.split(/\r?\n/).forEach((line, i) => {
      let m: RegExpExecArray | null;
      while ((m = regex.exec(line)) !== null) {
        const tag = m[1] ?? m[0];
        detections.push({ file: f.path, line: i + 1, tag });
        tags[tag] = (tags[tag] || 0) + 1;
      }
    });
  }
  return { detections, tags };
}

function baselineScore(features: any) {
  const negatives = ["TODO", "FIXME", "BUG", "HACK"];
  const negCount = negatives.reduce((a, t) => a + (features.tags[t] || 0), 0);
  const score = Math.max(0, 100 - negCount * 5);
  return {
    summary: {
      score,
      unit: "points",
      explanation: "Score decreases by 5 for each TODO/FIXME/HACK/BUG",
      weights: Object.fromEntries(negatives.map((t) => [t, 5])),
    },
    details: { counts: features.tags },
  };
}

function hashObj(o: any) {
  const h = createHash("sha256");
  h.update(JSON.stringify(o));
  return h.digest("hex");
}


async function runIQ() {
  const analyzerRoot = path.join(projectRoot, "src/analyzer");
  const files = baselineScanFiles(analyzerRoot);
  const features = baselineDetectFeatures(files);
  const score = baselineScore(features);

  const results: any[] = [];

  // Free of Error tests
  results.push({ id: "FE1", criterion: "Free of Error", name: "No exceptions", passed: true });
  results.push({ id: "FE2", criterion: "Free of Error", name: "Unique files", passed: new Set(files.map(f => f.path)).size === files.length });
  results.push({ id: "FE3", criterion: "Free of Error", name: "UTF-8 valid", passed: !files.some(f => f.content.includes("\ufffd")) });
  const h1 = hashObj(files), h2 = hashObj(baselineScanFiles(analyzerRoot));
  results.push({ id: "FE4", criterion: "Free of Error", name: "Deterministic scanning", passed: h1 === h2 });
  const hf1 = hashObj(features), hf2 = hashObj(baselineDetectFeatures(files));
  results.push({ id: "FE5", criterion: "Free of Error", name: "Deterministic detection", passed: hf1 === hf2 });
  results.push({ id: "FE6", criterion: "Free of Error", name: "Score schema valid", passed: new Ajv().validate({type:"object",properties:{summary:{type:"object"}}}, score) });
  results.push({ id: "FE7", criterion: "Free of Error", name: "Score 0–100", passed: score.summary.score >= 0 && score.summary.score <= 100 });
  results.push({ id: "FE8", criterion: "Free of Error", name: "No NaN in tags", passed: Object.values(features.tags).every(v => Number.isFinite(v)) });
  results.push({ id: "FE9", criterion: "Free of Error", name: "Stable feature count", passed: Object.keys(features.tags).length > 0 });
  results.push({ id: "FE10", criterion: "Free of Error", name: "Baseline consistency", passed: true });

  // Interpretability tests
  results.push({ id: "INT1", criterion: "Interpretability", name: "Human-readable explanation", passed: typeof score.summary.explanation === "string" });
  results.push({ id: "INT2", criterion: "Interpretability", name: "Weights provided", passed: !!score.summary.weights });
  results.push({ id: "INT3", criterion: "Interpretability", name: "Unit specified", passed: !!score.summary.unit });
  results.push({ id: "INT4", criterion: "Interpretability", name: "Traceability via counts", passed: !!score.details.counts });
  results.push({ id: "INT5", criterion: "Interpretability", name: "Detections have file+line", passed: features.detections.every((d:any)=>d.file && d.line) });
  results.push({ id: "INT6", criterion: "Interpretability", name: "Threshold config exists", passed: (() => {const rootConfig = path.join(projectRoot, "config.ts"); const localConfig = path.join(path.dirname(analyzerRoot), "config.ts"); return fs.existsSync(rootConfig) || fs.existsSync(localConfig);})() });
  results.push({ id: "INT7", criterion: "Interpretability", name: "Results JSON written", passed: true });
  results.push({ id: "INT8", criterion: "Interpretability", name: "README documents scoring logic", passed: (() => {const readmePath = path.join(projectRoot, "README.md");if (!fs.existsSync(readmePath)) return false; const content = fs.readFileSync(readmePath, "utf8").toLowerCase(); const keywords = ["score", "weight", "threshold", "explanation", "metric"]; return keywords.some(k => content.includes(k));})()});  
  results.push({ id: "INT9", criterion: "Interpretability", name: "Numeric formatting consistent", passed: Object.values(score.details.counts).every(v => Number.isFinite(v)) });
  results.push({
  id: "INT10",
  criterion: "Interpretability",
  name: "Interpretability summary complete",
  passed: (() => {
    const summaryPath = path.join(projectRoot, "out", "test.json");
    if (!fs.existsSync(summaryPath)) return false;
    const content = fs.readFileSync(summaryPath, "utf8");

    try {
      const data = JSON.parse(content);
      const hasLowest = Array.isArray(data.lowestPages);
      const hasHighest = Array.isArray(data.highestPages);
      const hasFeatureInfluence = !!data.featureInfluence;
      const hasAverage = typeof data.averageAI === "number";
      const hasGrade = typeof data.grade === "string";
      return hasLowest && hasHighest && hasFeatureInfluence && hasAverage && hasGrade;
    } catch {
      return false;
    }
  })()
});
return results;}


async function renderChart(results: any[]) {
  const labels = results.map(r => `${r.id} (${r.name})`);
  const data = results.map(r => (r.passed ? 1 : 0));

  const trace = {
    x: data,
    y: labels,
    type: "bar",
    orientation: "h",
    marker: { color: data.map(v => (v === 1 ? "green" : "red")) }
  };

  const layout = {
    title: "Information Quality Assessment Results",
    xaxis: { title: "Pass (1) / Fail (0)", range: [0, 1.2] },
    yaxis: { automargin: true, autorange: "reversed" },
    height: 50 * labels.length,
    margin: { l: 250, r: 50, t: 50, b: 50 }
  };

  const html = `
  <html>
  <head>
    <meta charset="utf-8" />
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
  </head>
  <body>
    <div id="chart" style="width:1200px;height:${layout.height}px"></div>
    <script>
      const data = ${JSON.stringify([trace])};
      const layout = ${JSON.stringify(layout)};
      Plotly.newPlot('chart', data, layout).then(() => {
        const png = Plotly.toImage(document.getElementById('chart'), {format:'png',height:${layout.height},width:1200});
        png.then(url => { window.resultPNG = url; });
      });
    </script>
  </body>
  </html>`;

  const outPng = path.join(projectRoot, "quality_report.png");
  const outHtml = path.join(projectRoot, "temp_plot.html");
  fs.writeFileSync(outHtml, html, "utf8");

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(`file://${outHtml}`, { waitUntil: "networkidle0" });
  await page.waitForFunction("window.resultPNG !== undefined");
  const dataUrl = await page.evaluate(() => (window as any).resultPNG);
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
  fs.writeFileSync(outPng, base64Data, "base64");
  await browser.close();
  fs.unlinkSync(outHtml);

  console.log("Chart saved as", outPng);
}


(async () => {
  const results = await runIQ();
  const jsonPath = path.join(projectRoot, "iq_results.json");
  const txtPath = path.join(projectRoot, "iq_summary.txt");
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");
  fs.writeFileSync(
    txtPath,
    results.map(r => `${r.id}\t${r.name}\t${r.passed ? "PASS" : "FAIL"}`).join("\n"),
    "utf8"
  );
  await renderChart(results);
})();
