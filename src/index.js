// ============================================
// Main Orchestrator — Pipeline runner
// ============================================
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';
import { parseResume, findResumeFile } from './resume/resumeParser.js';
import { scrapeAllSites } from './scrapers/apifyClient.js';
import { normalizeJobs } from './scrapers/jobNormalizer.js';
import { filterJobs } from './scrapers/jobFilter.js';
import { rewriteResumesForJobs } from './resume/resumeRewriter.js';
import { generateExcel } from './output/excelGenerator.js';
import { getDateString } from './utils/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

/**
 * Load site configurations from config/sites.json
 * @returns {Array} - Site config array
 */
function loadSiteConfigs() {
    const configPath = path.join(ROOT_DIR, 'config', 'sites.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(
            '❌ config/sites.json not found!\n' +
            '   Run "npm run setup" to configure your job sites.'
        );
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

/**
 * Load global settings from config/settings.json
 * @returns {object} - Settings object
 */
function loadSettings() {
    const settingsPath = path.join(ROOT_DIR, 'config', 'settings.json');
    if (!fs.existsSync(settingsPath)) {
        return {
            scraping: { maxJobsPerSite: 20, jobAgeHours: 24 },
            ai: { concurrentRewrites: 5 },
            output: { directory: './output', maxDescriptionLength: 500 },
        };
    }
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
}

/**
 * Run the full job scraping pipeline
 * @returns {object} - Pipeline result summary
 */
export async function runPipeline() {
    const startTime = Date.now();
    const dateStr = getDateString();

    logger.info('═'.repeat(60));
    logger.info(`🚀 JOB SCRAPER PIPELINE — ${getDateString('readable')}`);
    logger.info('═'.repeat(60));

    try {
        // ── Step 1: Load Configuration ──────────────────
        logger.info('\n📋 Step 1/7: Loading configuration...');
        const siteConfigs = loadSiteConfigs();
        const settings = loadSettings();
        logger.info(`   ${siteConfigs.filter(s => s.enabled).length} sites enabled`);

        // ── Step 2: Parse Resume ────────────────────────
        logger.info('\n📄 Step 2/7: Parsing resume...');
        const resumePath = findResumeFile(path.join(ROOT_DIR, 'resume'));

        if (!resumePath) {
            throw new Error(
                '❌ No resume PDF found!\n' +
                '   Place your resume.pdf in the "resume/" folder and try again.'
            );
        }

        const parsedResume = await parseResume(resumePath);

        // ── Step 3: Scrape All Sites ────────────────────
        logger.info('\n🌐 Step 3/7: Scraping job sites...');
        const scraperResults = await scrapeAllSites(siteConfigs);

        // ── Step 4: Normalize Jobs ──────────────────────
        logger.info('\n🔄 Step 4/7: Normalizing job data...');
        const normalizedJobs = normalizeJobs(scraperResults, siteConfigs);

        // ── Step 5: Filter Jobs ─────────────────────────
        logger.info('\n🔍 Step 5/7: Filtering jobs...');
        const filteredJobs = filterJobs(normalizedJobs, {
            maxAgeHours: parseInt(process.env.JOB_AGE_HOURS) || settings.scraping?.jobAgeHours || 24,
        });

        if (filteredJobs.length === 0) {
            logger.warn('⚠ No jobs found after filtering. Pipeline stopping early.');
            return {
                date: dateStr,
                totalScraped: normalizedJobs.length,
                totalFiltered: 0,
                outputFile: null,
                duration: ((Date.now() - startTime) / 1000).toFixed(1),
            };
        }

        // ── Step 6: AI Resume Rewriting ─────────────────
        logger.info('\n🤖 Step 6/7: Tailoring resumes with AI...');
        const concurrency = settings.ai?.concurrentRewrites || 5;
        const enrichedJobs = await rewriteResumesForJobs(parsedResume, filteredJobs, concurrency);

        // ── Step 7: Generate Excel ──────────────────────
        logger.info('\n📊 Step 7/7: Generating Excel file...');
        const outputPath = await generateExcel(enrichedJobs, {
            outputDir: process.env.OUTPUT_DIR || settings.output?.directory || './output',
            maxDescriptionLength: settings.output?.maxDescriptionLength || 500,
        });

        // ── Summary ─────────────────────────────────────
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const summary = {
            date: dateStr,
            totalScraped: normalizedJobs.length,
            totalFiltered: filteredJobs.length,
            totalEnriched: enrichedJobs.length,
            outputFile: outputPath,
            duration: elapsed,
            avgMatchScore: enrichedJobs.length > 0
                ? (enrichedJobs.reduce((sum, j) => sum + (j.matchScore || 0), 0) / enrichedJobs.length).toFixed(1)
                : 0,
        };

        logger.info('\n' + '═'.repeat(60));
        logger.info('✅ PIPELINE COMPLETE');
        logger.info('═'.repeat(60));
        logger.info(`   📅 Date:          ${summary.date}`);
        logger.info(`   📊 Jobs scraped:  ${summary.totalScraped}`);
        logger.info(`   🔍 Jobs filtered: ${summary.totalFiltered}`);
        logger.info(`   ⭐ Avg match:     ${summary.avgMatchScore}/10`);
        logger.info(`   📁 Output:        ${summary.outputFile}`);
        logger.info(`   ⏱  Duration:      ${summary.duration}s`);
        logger.info('═'.repeat(60));

        // Desktop notification
        await sendNotification(summary);

        return summary;

    } catch (error) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.error(`\n❌ PIPELINE FAILED after ${elapsed}s:`);
        logger.error(`   ${error.message}`);
        logger.error(error.stack);

        // Notify on failure too
        await sendNotification(null, error);

        throw error;
    }
}

/**
 * Send desktop notification about pipeline results
 * @param {object|null} summary - Pipeline summary
 * @param {Error|null} error - Error if pipeline failed
 */
async function sendNotification(summary, error = null) {
    if (process.env.NOTIFICATIONS_ENABLED === 'false') return;

    try {
        const notifier = await import('node-notifier');

        if (error) {
            notifier.default.notify({
                title: '❌ Job Scraper Failed',
                message: error.message.substring(0, 100),
                sound: true,
                icon: path.join(ROOT_DIR, 'assets', 'icon.png'),
            });
        } else if (summary) {
            notifier.default.notify({
                title: '✅ Job Scraper Complete',
                message: `Found ${summary.totalFiltered} jobs! Avg match: ${summary.avgMatchScore}/10\nOutput: ${path.basename(summary.outputFile)}`,
                sound: true,
                icon: path.join(ROOT_DIR, 'assets', 'icon.png'),
            });
        }
    } catch {
        // Notification is best-effort, don't fail the pipeline
    }
}
