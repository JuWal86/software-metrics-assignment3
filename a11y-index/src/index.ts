import path from "path";
import chalk from "chalk";
import { analyzeFile } from "./analyzer/featureDetector.ts";
import { scoreFeatures, aggregate } from "./analyzer/scoring.ts";
import { listFiles, writeJSON } from "./utils/file.ts";
import { config } from "./config.ts";

(async () => {
  const repoPath = process.argv[2] || ".";
  const files = listFiles(repoPath, config.extensions);
  const debug = process.env.DEBUG === "1";   // turn on with DEBUG=1

  const results = files.map(f => {
    const features = analyzeFile(f);
    const ai = scoreFeatures(features);
    if (debug) {
      console.log(chalk.gray(`\nFile: ${f}`));
      console.table(features);   // show raw category counts
      console.log(chalk.cyan(`Accesibility Index → ${ai}`));
    }
    return { file: f, ai, features };
  });

  const summary = aggregate(results);
    const sorted = [...results].sort((a, b) => a.ai - b.ai);

  console.log(chalk.cyan("\nLowest scoring pages:"));
  sorted.slice(0, 3).forEach(r =>
    console.log(chalk.red(`${path.basename(r.file)} → ${r.ai}`))
  );

  console.log(chalk.cyan("\nHighest scoring pages:"));
  sorted.slice(-3).reverse().forEach(r =>
    console.log(chalk.green(`${path.basename(r.file)} → ${r.ai}`))
  );

  // console.log(chalk.cyan(`\nAccessibility Index Summary for ${repoPath}`));
  // console.log(chalk.cyan("------------------------------------------"));
  // results.slice(0, 10).forEach(r => {
  //   const color =
  //     r.ai >= config.thresholds.green ? chalk.green :
  //     r.ai >= config.thresholds.orange ? chalk.yellow : chalk.red;
  //   console.log(color(`${path.basename(r.file)} → ${r.ai}`));
  // });

  console.log(chalk.gray(`Analyzed ${summary.totalAnalyzed} pages`));
  console.log(chalk.gray(`Included in average: ${summary.includedInAverage}`));

  if (summary.featureInfluence && summary.featureInfluence.length > 0) {
  console.log(chalk.cyan("\nFeature influence summary:"));
  summary.featureInfluence.forEach((f, i) => {
    const color = i === 0 ? chalk.greenBright :
                  i < 3 ? chalk.yellowBright :
                  chalk.gray;
    console.log(color(`  ${i + 1}. ${f}`));
  });

  // Optional interpretability text summary
  const top = summary.featureInfluence[0]?.split(" ")[0];
  const pen = Object.keys(summary.featureInfluence)
    .find(k => k.toLowerCase().includes("penal"));
  console.log(chalk.gray(`\nMost influential factor: ${top || "N/A"}${pen ? `; penalties also had noticeable impact.` : "."}`));
}


  console.log("\nAverage Accessibility Index:", chalk.bold(summary.averageAI));
  const gradeColor =
    summary.grade === "green" ? chalk.greenBright :
    summary.grade === "orange" ? chalk.yellowBright : chalk.redBright;
  console.log("Grade:", gradeColor(summary.grade.toUpperCase()));

  // Compute lowest/highest pages for interpretability reporting
const lowestPages = results
  .sort((a, b) => a.ai - b.ai)
  .slice(0, 3)
  .map(r => ({ file: r.file, ai: r.ai }));

const highestPages = results
  .sort((a, b) => b.ai - a.ai)
  .slice(0, 3)
  .map(r => ({ file: r.file, ai: r.ai }));

// Wrap everything into a clear structured summary
const extendedOutput = {
  lowestPages,
  highestPages,
  featureInfluence: summary.featureInfluence || {}, // if present
  averageAI: summary.averageAI,
  grade: summary.grade,
  results
};

// Now write the full JSON
writeJSON("out/test.json", extendedOutput);
})();
