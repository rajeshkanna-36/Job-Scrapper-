// ============================================
// Apify Client — Job scraping via Apify actors
// ============================================
import { ApifyClient } from 'apify-client';
import logger from '../utils/logger.js';
import { retryAsync } from '../utils/helpers.js';
import { scrapeLinkedIn } from './linkedinScraper.js';

let client = null;

/**
 * Initialize the Apify client with API token
 * @returns {ApifyClient}
 */
function getClient() {
    if (!client) {
        const token = process.env.APIFY_API_TOKEN;
        if (!token || token === 'your_apify_token_here') {
            throw new Error(
                '❌ APIFY_API_TOKEN not configured!\n' +
                '   Run "npm run setup" or add your token to .env file.\n' +
                '   Get your free token at: https://console.apify.com/account/integrations'
            );
        }
        client = new ApifyClient({ token });
    }
    return client;
}

/**
 * Scrape jobs from a single site using its Apify actor
 * @param {object} siteConfig - Site configuration from sites.json
 * @returns {object} - { site, jobs, error }
 */
export async function scrapeSite(siteConfig) {
    const { name, actorId, searchParams } = siteConfig;

    logger.info(`🌐 Scraping ${name}...`);
    const startTime = Date.now();

    // Branch logic: LinkedIn now uses local open-source scraper instead of paid Apify Cloud
    if (name === "LinkedIn") {
        try {
            const jobs = await scrapeLinkedIn(siteConfig);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            logger.info(`✅ ${name}: ${jobs.length} jobs scraped locally (${elapsed}s)`);
            return {
                site: name,
                jobs: jobs,
                error: null,
            };
        } catch (error) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            logger.error(`❌ ${name}: Local scraping failed (${elapsed}s) — ${error.message}`);
            return {
                site: name,
                jobs: [],
                error: error.message,
            };
        }
    }

    try {
        const result = await retryAsync(async () => {
            const apify = getClient();

            // Prepare input for the actor
            const input = {
                ...searchParams,
            };

            // Run the actor and wait for completion
            logger.debug(`   Actor: ${actorId}, Input: ${JSON.stringify(input)}`);
            const run = await apify.actor(actorId).call(input, {
                waitSecs: 120, // Wait up to 2 minutes for completion
            });

            // Fetch results from the dataset
            const { items } = await apify.dataset(run.defaultDatasetId).listItems();

            return items;
        }, 3, 2000);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.info(`✅ ${name}: ${result.length} jobs scraped (${elapsed}s)`);

        return {
            site: name,
            jobs: result,
            error: null,
        };
    } catch (error) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.error(`❌ ${name}: Scraping failed (${elapsed}s) — ${error.message}`);

        return {
            site: name,
            jobs: [],
            error: error.message,
        };
    }
}

/**
 * Scrape all enabled sites in parallel
 * @param {Array} siteConfigs - Array of site configurations
 * @returns {Array} - Array of { site, jobs, error } results
 */
export async function scrapeAllSites(siteConfigs) {
    const enabledSites = siteConfigs.filter(s => s.enabled);

    if (enabledSites.length === 0) {
        logger.warn('⚠ No sites enabled for scraping. Check config/sites.json');
        return [];
    }

    logger.info(`🚀 Starting sequential scrape of ${enabledSites.length} site(s)...`);
    logger.info(`   Sites: ${enabledSites.map(s => s.name).join(', ')}`);

    // Run scrapers sequentially to stay within Apify free-tier memory limits
    const scraperResults = [];
    for (const site of enabledSites) {
        const result = await scrapeSite(site);
        scraperResults.push(result);

        // Small delay between sites to let Apify release resources
        if (enabledSites.indexOf(site) < enabledSites.length - 1) {
            logger.debug('   ⏳ Waiting 3s before next site...');
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    // Log summary
    const totalJobs = scraperResults.reduce((sum, r) => sum + r.jobs.length, 0);
    const failedSites = scraperResults.filter(r => r.error);

    logger.info(`📊 Scraping complete: ${totalJobs} total jobs from ${enabledSites.length - failedSites.length}/${enabledSites.length} sites`);

    if (failedSites.length > 0) {
        logger.warn(`⚠ Failed sites: ${failedSites.map(r => `${r.site} (${r.error})`).join(', ')}`);
    }

    return scraperResults;
}
