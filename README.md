# 🔍 Job Scraper — Automated Job Hunting Pipeline

An end-to-end **automated job scraping pipeline** that fetches fresh job listings from multiple platforms, tailors your resume to each job description using **OpenAI**, and outputs a beautifully styled **Excel report** — ready for daily use via a built-in CRON scheduler.

> **Built for freshers & job seekers** who want to apply smarter, not harder.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🌐 **Multi-Site Scraping** | Scrapes jobs from **LinkedIn, Indeed, Glassdoor, Naukri, RemoteOK** via Apify actors |
| 🔓 **Free LinkedIn Scraping** | LinkedIn uses a local open-source Puppeteer-based scraper — **no paid Apify actor needed** |
| 🤖 **AI Resume Tailoring** | OpenAI rewrites your resume summary per job description, scoring match quality (1–10) |
| 📊 **Styled Excel Output** | Generates a professional `.xlsx` with color-coded scores, clickable apply links, dropdown status tracking |
| ⏰ **Daily CRON Scheduler** | Runs automatically every day at a configured time (default: 9 AM IST) |
| 🔧 **Interactive Setup Wizard** | `npm run setup` walks you through API keys, search keywords, sites, and schedule |
| 🔔 **Desktop Notifications** | Get notified when the pipeline finishes or fails |
| 📝 **Structured Logging** | Winston-based logging with console output + file rotation (`logs/combined.log`, `logs/error.log`) |
| 🔁 **Retry & Deduplication** | Exponential backoff on failures + MD5-based dedup across sources |

---

## 📐 Architecture & Pipeline

The scraper runs a **7-step pipeline** every execution:

```
┌──────────────────────────────────────────────────────────────────────┐
│                       JOB SCRAPER PIPELINE                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Step 1 ─ Load Configuration     (config/sites.json, settings.json)  │
│     │                                                                │
│  Step 2 ─ Parse Resume           (resume/*.pdf → structured text)    │
│     │                                                                │
│  Step 3 ─ Scrape All Sites       (Apify Cloud + Local LinkedIn)      │
│     │                                                                │
│  Step 4 ─ Normalize Jobs         (unified schema via field mapping)  │
│     │                                                                │
│  Step 5 ─ Filter & Deduplicate   (24h age filter + MD5 dedup)        │
│     │                                                                │
│  Step 6 ─ AI Resume Rewriting    (OpenAI tailors resume per JD)      │
│     │                                                                │
│  Step 7 ─ Generate Excel         (styled .xlsx with apply links)     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🗂 Project Structure

```
Job Scraper/
├── config/
│   ├── sites.json              # Per-site scraper configs (actors, field mappings, search params)
│   └── settings.json           # Global settings (schedule, AI params, output options)
├── scripts/
│   ├── setup.js                # Interactive first-time setup wizard
│   └── run-once.js             # Manual one-shot pipeline execution
├── src/
│   ├── index.js                # Main pipeline orchestrator (7-step pipeline)
│   ├── scheduler.js            # CRON-based daily scheduler
│   ├── scrapers/
│   │   ├── apifyClient.js      # Apify Cloud client (runs actors for Indeed, Glassdoor, etc.)
│   │   ├── linkedinScraper.js  # Local open-source LinkedIn scraper (Puppeteer-based, free)
│   │   ├── jobNormalizer.js    # Maps raw scraper output → unified job schema
│   │   └── jobFilter.js       # 24h age filter + deduplication + sorting
│   ├── resume/
│   │   ├── resumeParser.js     # Extracts structured text & sections from resume PDF
│   │   └── resumeRewriter.js   # OpenAI-powered resume tailoring per job description
│   ├── output/
│   │   └── excelGenerator.js   # Generates styled Excel with color-coded scores & hyperlinks
│   └── utils/
│       ├── logger.js           # Winston logger (console + file transports)
│       └── helpers.js          # Date utils, hashing, retry logic, text cleaning
├── resume/                     # Place your resume.pdf here (gitignored)
├── output/                     # Generated Excel files land here (gitignored)
├── logs/                       # Log files (gitignored)
├── .env.example                # Template for environment variables
├── .gitignore
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18 or higher
- **Apify Account** — [Free tier](https://console.apify.com/sign-up) (for Indeed, Glassdoor, Naukri, RemoteOK)
- **OpenAI API Key** — [Get one here](https://platform.openai.com/api-keys)

### 1. Clone the Repository

```bash
git clone https://github.com/RajeshKanna-s/job-scraper.git
cd job-scraper
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Setup Wizard

```bash
npm run setup
```

This interactive wizard will ask for:
- 🔑 Your **Apify API token** and **OpenAI API key**
- 🔍 **Job search keywords** and location
- 🌐 Which **job sites** to enable
- ⏰ **Schedule time** for daily runs

It generates your `.env` file and updates `config/sites.json` automatically.

### 4. Add Your Resume

```bash
# Place your resume PDF in the resume/ folder
cp ~/path/to/your-resume.pdf ./resume/resume.pdf
```

### 5. Run Once (Test)

```bash
npm run run
```

### 6. Start the Daily Scheduler

```bash
npm start
```

The scraper will now run automatically every day at the configured time.

---

## ⚙️ Configuration

### Environment Variables (`.env`)

| Variable | Default | Description |
|---|---|---|
| `APIFY_API_TOKEN` | — | Your Apify API token |
| `OPENAI_API_KEY` | — | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model (`gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`) |
| `SCHEDULE_CRON` | `0 9 * * *` | CRON expression for scheduler (default: 9 AM daily) |
| `TIMEZONE` | `Asia/Kolkata` | Timezone for the scheduler |
| `MAX_JOBS_PER_SITE` | `20` | Maximum jobs to fetch per site |
| `JOB_AGE_HOURS` | `24` | Only include jobs posted within this many hours |
| `OUTPUT_DIR` | `./output` | Directory for generated Excel files |
| `LOG_LEVEL` | `info` | Logging level (`error`, `warn`, `info`, `debug`) |
| `NOTIFICATIONS_ENABLED` | `true` | Enable/disable desktop notifications |

### Site Configuration (`config/sites.json`)

Each job site is defined with:

```jsonc
{
  "name": "LinkedIn",              // Display name
  "actorId": "bebity/linkedin-jobs-scraper",  // Apify actor ID
  "enabled": true,                 // Toggle on/off
  "color": "#0A66C2",             // Brand color (used in Excel output)
  "searchParams": {                // Parameters sent to the actor
    "keywords": "Full Stack Developer",
    "location": "India",
    "maxJobs": 20
  },
  "fieldMapping": {                // Maps raw API fields → unified schema
    "title": "title",
    "company": "companyName",
    "location": "location",
    "description": "description",
    "applyUrl": "jobUrl",
    "postedDate": "publishedAt"
  }
}
```

**Supported Sites:** LinkedIn, Indeed, Glassdoor, Naukri, RemoteOK

> 💡 **LinkedIn** runs locally via Puppeteer (free). All other sites use Apify Cloud actors.

---

## 📊 Excel Output

Each run generates a file like `output/jobs_2026-04-15.xlsx` with:

### Jobs Sheet
- **#** — Serial number
- **⭐ Score** — AI match score (1–10), color-coded: 🟢 8+ | 🟡 5-7 | 🔴 <5
- **Job Title** — Bold, prominent
- **Company** — Employer name
- **Location** — City/country
- **Type / Remote** — Full-time, contract, remote/hybrid/on-site
- **Salary** — If available
- **Posted** — Relative time ("3h ago", "Yesterday")
- **Source** — Color-coded pill (LinkedIn blue, Indeed blue, etc.)
- **Job Description** — Truncated to 500 chars
- **Tailored Resume Summary** — AI-generated, highlighted background
- **Matching Skills** — Skills from your resume that match the JD
- **🔗 Apply Link** — Clickable hyperlink
- **Status** — Dropdown: Applied / Interview / Rejected / Skipped / Saved
- **Notes** — Free-text column for your notes

### Summary Sheet
- Total jobs found, source breakdown, average match score, score distribution

---

## 🧠 How AI Resume Tailoring Works

1. Your resume PDF is parsed and structured into sections (summary, experience, skills, etc.)
2. For each job, the **job description** and your **resume text** are sent to OpenAI
3. The AI generates:
   - A **tailored professional summary** (reworded to match the JD — never fabricated)
   - **Matching skills** extracted from your resume
   - **Keywords** incorporated from the job posting
   - A **match score** (1–10) based on fit
4. Results are written into the Excel alongside each job listing

> ⚠️ The AI only **rephrases** your existing experience — it never fabricates or adds false information.

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run setup` | Interactive setup wizard (API keys, search params, sites, schedule) |
| `npm run run` | Run the pipeline once (manual/test) |
| `npm start` | Start the CRON scheduler for daily automated runs |

---

## 🛡 Privacy & Security

- Your **resume** (`resume/*.pdf`) is **gitignored** and never leaves your machine except to OpenAI for AI processing
- Your **API keys** (`.env`) are **gitignored** — only `.env.example` is committed
- **Excel output** files are **gitignored**
- **Log files** are **gitignored**

---

## 🧰 Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js** (ES Modules) | Runtime |
| **Apify Client** | Cloud-based web scraping actors |
| **linkedin-jobs-scraper** | Local open-source LinkedIn scraping via Puppeteer |
| **OpenAI SDK** | GPT-powered resume tailoring |
| **ExcelJS** | Styled `.xlsx` generation |
| **node-cron** | CRON-based daily scheduling |
| **Winston** | Structured logging with file rotation |
| **pdf-parse** | Resume PDF text extraction |
| **p-limit** | Concurrency control for API calls |
| **Inquirer** | Interactive CLI setup wizard |
| **node-notifier** | Native desktop notifications |
| **dotenv** | Environment variable management |

---

## 📄 License

ISC © [Rajesh Kanna](https://github.com/RajeshKanna-s)
