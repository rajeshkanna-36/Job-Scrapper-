// ============================================
// Job Normalizer — Unified schema mapping
// ============================================
import { generateJobHash, cleanText } from '../utils/helpers.js';
import logger from '../utils/logger.js';

/**
 * Normalize raw scraper results into a unified job schema
 * @param {Array} scraperResults - Array of { site, jobs, error } from scrapeAllSites
 * @param {Array} siteConfigs - Site configurations with field mappings
 * @returns {Array} - Array of normalized job objects
 */
export function normalizeJobs(scraperResults, siteConfigs) {
    const normalizedJobs = [];

    for (const result of scraperResults) {
        if (result.error || !result.jobs.length) continue;

        // Find the matching site config for field mapping
        const siteConfig = siteConfigs.find(s => s.name === result.site);
        if (!siteConfig) {
            logger.warn(`⚠ No config found for site: ${result.site}`);
            continue;
        }

        const { fieldMapping, name: siteName } = siteConfig;

        for (const rawJob of result.jobs) {
            try {
                const normalized = mapJobFields(rawJob, fieldMapping, siteName);
                if (normalized) {
                    normalizedJobs.push(normalized);
                }
            } catch (error) {
                logger.debug(`   Skipping malformed job from ${siteName}: ${error.message}`);
            }
        }
    }

    logger.info(`🔄 Normalized ${normalizedJobs.length} jobs from ${scraperResults.length} site(s)`);
    return normalizedJobs;
}

/**
 * Map raw job fields to unified schema using site-specific field mapping
 * @param {object} rawJob - Raw job data from Apify
 * @param {object} fieldMapping - Field name mapping
 * @param {string} source - Source site name
 * @returns {object|null} - Normalized job or null if invalid
 */
function mapJobFields(rawJob, fieldMapping, source) {
    // Extract fields using mapping (with fallbacks)
    const title = getField(rawJob, fieldMapping.title) || getField(rawJob, 'title') || getField(rawJob, 'name');
    const company = getField(rawJob, fieldMapping.company) || getField(rawJob, 'company') || 'Unknown Company';
    const location = getField(rawJob, fieldMapping.location) || getField(rawJob, 'location') || 'Not specified';
    const description = getField(rawJob, fieldMapping.description) || getField(rawJob, 'description') || '';
    const applyUrl = getField(rawJob, fieldMapping.applyUrl) || getField(rawJob, 'url') || getField(rawJob, 'link') || '';
    const postedDate = getField(rawJob, fieldMapping.postedDate) || getField(rawJob, 'postedAt') || getField(rawJob, 'date') || '';
    const salary = getField(rawJob, fieldMapping.salary) || getField(rawJob, 'salary') || '';
    const jobType = getField(rawJob, fieldMapping.jobType) || getField(rawJob, 'jobType') || '';

    // Skip jobs without a title (minimum required field)
    if (!title) return null;

    const normalized = {
        title: cleanText(title),
        company: cleanText(company),
        location: cleanText(location),
        jobType: cleanText(typeof jobType === 'object' ? JSON.stringify(jobType) : String(jobType)),
        remote: detectRemote(location, title, description),
        salary: cleanText(typeof salary === 'object' ? JSON.stringify(salary) : String(salary)),
        description: cleanText(description),
        postedDate: parseDate(postedDate),
        applyUrl: String(applyUrl).trim(),
        source,
        scrapedAt: new Date().toISOString(),
    };

    // Generate unique ID for deduplication
    normalized.id = generateJobHash(normalized);

    return normalized;
}

/**
 * Safely get a nested field from an object using dot notation or direct key
 * @param {object} obj - Source object
 * @param {string} fieldPath - Field name or dot-separated path
 * @returns {*} - Field value or undefined
 */
function getField(obj, fieldPath) {
    if (!fieldPath || !obj) return undefined;

    // Direct key access
    if (obj[fieldPath] !== undefined) return obj[fieldPath];

    // Dot notation (e.g., "company.name")
    const parts = fieldPath.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
}

/**
 * Detect if a job is remote, hybrid, or on-site
 * @param {string} location
 * @param {string} title
 * @param {string} description
 * @returns {string}
 */
function detectRemote(location, title, description) {
    const combined = `${location} ${title} ${description}`.toLowerCase();

    if (combined.includes('remote')) return 'Remote';
    if (combined.includes('hybrid')) return 'Hybrid';
    if (combined.includes('work from home') || combined.includes('wfh')) return 'Remote';
    return 'On-site';
}

/**
 * Parse various date formats into ISO string
 * @param {*} dateValue - Date string, timestamp, or Date object
 * @returns {string} - ISO date string or empty string
 */
function parseDate(dateValue) {
    if (!dateValue) return '';

    try {
        // Handle relative dates like "2 hours ago", "1 day ago"
        if (typeof dateValue === 'string') {
            const relativeMatch = dateValue.match(/(\d+)\s*(hour|minute|day|week|month)s?\s*ago/i);
            if (relativeMatch) {
                const amount = parseInt(relativeMatch[1]);
                const unit = relativeMatch[2].toLowerCase();
                const now = new Date();

                const multipliers = {
                    minute: 60 * 1000,
                    hour: 60 * 60 * 1000,
                    day: 24 * 60 * 60 * 1000,
                    week: 7 * 24 * 60 * 60 * 1000,
                    month: 30 * 24 * 60 * 60 * 1000,
                };

                return new Date(now.getTime() - amount * (multipliers[unit] || 0)).toISOString();
            }
        }

        // Handle Unix timestamps (seconds or milliseconds)
        if (typeof dateValue === 'number') {
            const date = dateValue > 1e12 ? new Date(dateValue) : new Date(dateValue * 1000);
            return date.toISOString();
        }

        // Try parsing as Date string
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
        }

        return String(dateValue);
    } catch {
        return String(dateValue);
    }
}
