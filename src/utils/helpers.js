// ============================================
// Helpers — Utility functions
// ============================================
import crypto from 'crypto';

/**
 * Check if a date string is within the last N hours
 * @param {string|Date} dateValue - The date to check
 * @param {number} hours - Number of hours to look back (default: 24)
 * @returns {boolean}
 */
export function isWithinHours(dateValue, hours = 24) {
    if (!dateValue) return true; // If no date, include it (be lenient)

    try {
        const jobDate = new Date(dateValue);
        const now = new Date();
        const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

        // If parsing fails, include the job
        if (isNaN(jobDate.getTime())) return true;

        return jobDate >= cutoff;
    } catch {
        return true; // If error, include the job
    }
}

/**
 * Generate a unique hash for deduplication based on job title + company + location
 * @param {object} job - Normalized job object
 * @returns {string} - MD5 hash
 */
export function generateJobHash(job) {
    const raw = `${(job.title || '').toLowerCase().trim()}|${(job.company || '').toLowerCase().trim()}|${(job.location || '').toLowerCase().trim()}`;
    return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLen - Maximum length
 * @returns {string}
 */
export function truncateText(text, maxLen = 500) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + '...';
}

/**
 * Retry an async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} retries - Number of retries (default: 3)
 * @param {number} baseDelay - Base delay in ms (default: 2000)
 * @returns {*} - Result of the function
 */
export async function retryAsync(fn, retries = 3, baseDelay = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === retries) throw error;
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.warn(`⚠ Attempt ${attempt}/${retries} failed. Retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get today's date as a formatted string
 * @param {string} format - 'YYYY-MM-DD' or 'readable'
 * @returns {string}
 */
export function getDateString(format = 'YYYY-MM-DD') {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    if (format === 'readable') {
        return now.toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Deduplicate an array of jobs by hash
 * @param {Array} jobs - Array of normalized job objects (must have .id field)
 * @returns {Array} - Deduplicated array
 */
export function deduplicateJobs(jobs) {
    const seen = new Set();
    return jobs.filter(job => {
        if (seen.has(job.id)) return false;
        seen.add(job.id);
        return true;
    });
}

/**
 * Clean text by removing excessive whitespace, HTML tags, etc.
 * @param {string} text
 * @returns {string}
 */
export function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/<[^>]*>/g, '')        // Remove HTML tags
        .replace(/&[a-z]+;/gi, ' ')     // Remove HTML entities
        .replace(/\s+/g, ' ')           // Collapse whitespace
        .trim();
}
