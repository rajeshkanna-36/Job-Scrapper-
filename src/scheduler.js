// ============================================
// Scheduler — Daily CRON trigger
// ============================================
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { runPipeline } from './index.js';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const CRON_EXPRESSION = process.env.SCHEDULE_CRON || '0 9 * * *';
const TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';

// ── Validate CRON expression ────────────────────
if (!cron.validate(CRON_EXPRESSION)) {
    logger.error(`❌ Invalid CRON expression: "${CRON_EXPRESSION}"`);
    logger.error('   Format: minute hour dayOfMonth month dayOfWeek');
    logger.error('   Example: "0 9 * * *" = every day at 9:00 AM');
    process.exit(1);
}

// ── Display startup banner ──────────────────────
logger.info('');
logger.info('╔═══════════════════════════════════════════════════╗');
logger.info('║          🔍 JOB SCRAPER — SCHEDULER MODE          ║');
logger.info('╠═══════════════════════════════════════════════════╣');
logger.info(`║  Schedule:  ${CRON_EXPRESSION.padEnd(38)}║`);
logger.info(`║  Timezone:  ${TIMEZONE.padEnd(38)}║`);
logger.info(`║  Started:   ${new Date().toLocaleString('en-IN', { timeZone: TIMEZONE }).padEnd(38)}║`);
logger.info('╠═══════════════════════════════════════════════════╣');
logger.info('║  Press Ctrl+C to stop the scheduler               ║');
logger.info('╚═══════════════════════════════════════════════════╝');
logger.info('');

// ── Track run state ─────────────────────────────
let isRunning = false;
let runCount = 0;

// ── Schedule the daily job ──────────────────────
const task = cron.schedule(CRON_EXPRESSION, async () => {
    if (isRunning) {
        logger.warn('⚠ Pipeline is already running. Skipping this trigger.');
        return;
    }

    isRunning = true;
    runCount++;

    logger.info(`\n⏰ Scheduled trigger #${runCount} fired at ${new Date().toLocaleString('en-IN', { timeZone: TIMEZONE })}`);

    try {
        await runPipeline();
    } catch (error) {
        logger.error(`Pipeline run #${runCount} failed: ${error.message}`);
    } finally {
        isRunning = false;
    }
}, {
    timezone: TIMEZONE,
    scheduled: true,
});

// ── Graceful shutdown ───────────────────────────
process.on('SIGINT', () => {
    logger.info('\n🛑 Scheduler shutting down...');
    task.stop();
    logger.info('   Scheduler stopped. Goodbye!');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('\n🛑 Received SIGTERM. Shutting down...');
    task.stop();
    process.exit(0);
});

// ── Keep process alive ──────────────────────────
logger.info(`⏳ Waiting for next trigger at CRON: "${CRON_EXPRESSION}" (${TIMEZONE})...`);
logger.info('   The scraper will automatically run at the scheduled time.');
logger.info('   To run immediately, use: npm run run');
