import { LinkedinScraper, events } from 'linkedin-jobs-scraper';
import logger from '../utils/logger.js';

/**
 * Scrape LinkedIn jobs locally using an open-source headless browser.
 * @param {object} siteConfig - Site configuration from sites.json
 * @returns {Array} - Array of job objects matching the Apify standard
 */
export async function scrapeLinkedIn(siteConfig) {
    return new Promise(async (resolve, reject) => {
        logger.info(`🌐 Launching local LinkedIn Scraper...`);
        const jobs = [];
        const maxJobs = siteConfig.searchParams?.maxJobs || 20;

        // Ensure we're using realistic parameters
        const query = new LinkedinScraper({
            headless: true,
            slowMo: 100, // Important: don't hit speed limits
            args: ["--lang=en-GB"],
        });

        // Event listener for each job found
        query.on(events.scraper.data, (data) => {
            logger.debug(`   Found job: ${data.title} at ${data.company}`);
            jobs.push({
                title: data.title,
                companyName: data.company,
                location: data.location,
                description: data.description,
                jobUrl: data.link,
                publishedAt: data.date,
                salary: undefined,
                contractType: undefined 
            });
        });

        // Event listeners for lifecycle
        query.on(events.scraper.error, (err) => {
            logger.error(`   ❌ LinkedIn Scraper Error: ${err}`);
        });

        query.on(events.scraper.end, () => {
            logger.info(`   ✅ LinkedIn scraping completed locally! Found ${jobs.length} jobs.`);
            resolve(jobs);
        });

        // Add filter to standard query format
        const filters = {
            relevance: 'RELEVANT',
            time: siteConfig.searchParams?.publishedAt === 'r86400' ? 'PAST_24_HOURS' : undefined,
        };

        // If the user specified experience level
        if (siteConfig.searchParams?.experienceLevel === "2") {
            filters.experience = ['ENTRY_LEVEL'];
        }

        try {
            // Initiate scrape
            await query.run([
                {
                    query: siteConfig.searchParams?.keywords || "Full Stack Developer",
                    options: {
                        locations: [(siteConfig.searchParams?.location || "India")],
                        limit: maxJobs,
                        filters: Object.keys(filters).length > 0 ? filters : undefined
                    }
                }
            ]);

            // Important: We must call query.close() to release Chromium,
            // but the 'end' event already fired so we resolve the array.
            // Wait, standard practice for linkedin-jobs-scraper is closing on end:
            query.close();
        } catch (e) {
            reject(e);
        }
    });
}
