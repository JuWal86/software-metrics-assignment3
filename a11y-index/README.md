# Developer Guide — Information Quality Test

This project analyzes web projects for Accessibility Index (AccessInd) and evaluates Information Quality (InfoQua) through automated tests.
It is written in TypeScript and uses Node.js with several dependencies (Plotly, Puppeteer, Chalk, etc.).

---

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd a11y-index
```

### 2. Install dependencies

After cloning, install all required dependencies:

```bash
npm install
```

This will recreate the `node_modules` directory based on `package.json` and `package-lock.json`.

---

## Running the Analyzer

### Analyze a project

Run the accessibility analyzer on a target website directory:

```bash
npm run analyze <path-to-project>
```

Example:

```bash
npm run analyze ../a11yproject.com
```

This will output:

* File-level Accessibility Index scores
* Feature influence summary
* Average AcessInd and grade
* A structured summary in `out/test.json`

---

## Running Information Quality Tests

To validate the integrity and interpretability of results, run:

```bash
npm run test:iq
```

This command:

* Executes all quality and interpretability checks
* Generates a summary in `iq_results.json` and `iq_summary.txt`
* Creates a visual chart in `quality_report.png`

---

## Common Commands

| Command                              | Description                           |
| ------------------------------------ | ------------------------------------- |
| `npm install`                        | Installs all dependencies             |
| `npm run analyze <path>`             | Runs accessibility index analysis     |
| `npm run test:iq`                    | Runs information quality tests        |
| `rm -rf node_modules && npm install` | Reinstalls dependencies (clean setup) |


---

## Notes for Developers

* Always run `npm install` before executing the analyzer to ensure dependencies are up to date.
* The `out/` folder contains generated results and reports.
* If `puppeteer` fails due to sandbox restrictions, try running with `--no-sandbox` as configured in `qualityTest.ts`.

