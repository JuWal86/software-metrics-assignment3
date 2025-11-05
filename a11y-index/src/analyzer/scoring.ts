import { config } from '../config.ts';
import type { A11yFeatures } from './featureDetector.ts';
import { clamp01 } from '../utils/normalize.ts';

export function scoreFeatures(f: A11yFeatures) {
  // Normalize gently by scaling per 100 tags instead of per tag
  const ratio = f.totalTags > 0 ? f.totalTags / 100 : 1;

  // Compute proportional scores (bounded between 0 and 1)
  const altScore = clamp01(f.altCount / ratio);
  const ariaScore = clamp01(f.ariaCount / ratio);
  const semanticsScore = clamp01(f.semanticCount / ratio);
  const labelScore = clamp01(f.labelCount / ratio);
  const keyboardScore = clamp01(f.keyboardCount / ratio);
  const penaltyScore = clamp01(f.penalties / (ratio * 2)); // softer penalty impact

  // Weighted sum — emphasize good practices, reduce penalty influence
  const weighted =
    altScore * config.weights.alt * 1.2 +
    ariaScore * config.weights.aria * 1.2 +
    semanticsScore * config.weights.semantics +
    labelScore * config.weights.label +
    keyboardScore * config.weights.keyboard -
    penaltyScore * config.weights.penalties * 0.5;

  // Apply a baseline so decent pages don’t score unrealistically low
  const adjusted = weighted;

  // Convert to percentage (0–100) and clamp to avoid overflow
  return Math.round(clamp01(adjusted) * 100);
}

export function aggregate(results: { file: string; ai: number; features?: { totalTags?: number } }[]) {
  const filtered = results.filter(r =>
    Number(r.features?.totalTags) >= 50
  );

  const validResults = filtered.length ? filtered : results;

  const numericAIs = validResults.map(r => Number(r.ai)).filter(v => !isNaN(v));

  const avg = numericAIs.reduce((s, v) => s + v, 0) / numericAIs.length;

  const grade =
    avg >= config.thresholds.green ? 'green' :
    avg >= config.thresholds.orange ? 'orange' : 'red';

  // Compute aggregate totals for all numeric features
const featureTotals: Record<string, number> = {};
for (const r of validResults) {
  const feats = r.features || {};
  for (const [k, v] of Object.entries(feats)) {
    if (typeof v === "number") {
      featureTotals[k] = (featureTotals[k] || 0) + v;
    }
  }
}

// Exclude totalTags when normalizing
const featureKeys = Object.keys(featureTotals).filter(k => k !== "totalTags");
const totalFeatureSum = featureKeys.reduce((sum, k) => sum + featureTotals[k], 0) || 1;

const normalizedInfluence = Object.fromEntries(
  featureKeys.map(k => [k, (featureTotals[k] / totalFeatureSum) * 100])
);

const topEntries = Object.entries(normalizedInfluence)
  .sort((a, b) => b[1] - a[1])
 
const topFeatures = topEntries
  .slice(0, 5)
  .map(([k, v]) => `${k} (${v.toFixed(1)}%)`);

  const shownSum = topEntries.slice(0, 5).reduce((s, [, v]) => s + v, 0);
const otherShare = Math.max(0, 100 - shownSum);
if (otherShare >= 0.1) topFeatures.push(`Other (${otherShare.toFixed(1)}%)`);


  return {
    averageAI: Math.round(avg),
    grade,
    totalAnalyzed: results.length,
    includedInAverage: validResults.length,
    featureInfluence: topFeatures
  };
}
