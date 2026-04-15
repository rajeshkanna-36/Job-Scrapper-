// ============================================
// Job Filter — 24hr age filter + deduplication
// ============================================
import { isWithinHours, deduplicateJobs } from '../utils/helpers.js';
import logger from '../utils/logger.js';

/**
 * Filter and deduplicate normalized jobs
 * @param {Array} jobs - Array of normalized job objects
 * @param {object} options - Filter options
 * @param {number} options.maxAgeHours - Maximum job age in hours (default: 24)
 * @returns {Array} - Filtered and deduplicated jobs, sorted newest first
 */
export function filterJobs(jobs, options = {}) {
    const { maxAgeHours = 24 } = options;

    const startCount = jobs.length;
    logger.info(`🔍 Filtering ${startCount} jobs (max age: ${maxAgeHours}h)...`);

    // Debug: log sample dates to see what we're working with
    if (startCount > 0) {
        const sampleJobs = jobs.slice(0, 3);
        for (const job of sampleJobs) {
            logger.debug(`   Sample: "${job.title}" @ ${job.company} | date: "${job.postedDate}" | url: "${job.applyUrl?.substring(0, 60)}"`);
        }
    }

    // Step 1: Filter by age (< maxAgeHours)
    let filtered = jobs.filter(job => {
        const passes = isWithinHours(job.postedDate, maxAgeHours);
        if (!passes) {
            logger.debug(`   ⏰ Age-filtered: "${job.title}" @ ${job.company} (date: ${job.postedDate})`);
        }
        return passes;
    });
    const afterAge = filtered.length;
    logger.info(`   After age filter: ${afterAge}/${startCount} jobs`);

    // Step 2: Deduplicate (same title + company + location)
    filtered = deduplicateJobs(filtered);
    const afterDedup = filtered.length;
    if (afterAge !== afterDedup) {
        logger.info(`   After dedup: ${afterDedup}/${afterAge} jobs (${afterAge - afterDedup} duplicates removed)`);
    }

    // Step 3: Sort by posted date (newest first)
    filtered.sort((a, b) => {
        const dateA = new Date(a.postedDate || 0);
        const dateB = new Date(b.postedDate || 0);
        return dateB - dateA;
    });

    // Step 4: Filter out jobs without any apply URL (lenient — accept any non-empty URL)
    const withUrl = filtered.filter(job => job.applyUrl && job.applyUrl.length > 0);
    if (withUrl.length !== filtered.length) {
        logger.info(`   Removed ${filtered.length - withUrl.length} jobs without apply URLs`);
        filtered = withUrl;
    }

    logger.info(`✅ Filter result: ${filtered.length}/${startCount} jobs passed all filters`);

    // Log source breakdown
    const sourceCounts = {};
    for (const job of filtered) {
        sourceCounts[job.source] = (sourceCounts[job.source] || 0) + 1;
    }
    const breakdown = Object.entries(sourceCounts).map(([s, c]) => `${s}: ${c}`).join(', ');
    if (breakdown) {
        logger.info(`   Sources: ${breakdown}`);
    }

    return filtered;
}
