// ============================================
// Resume Rewriter — OpenAI-powered tailoring
// ============================================
import OpenAI from 'openai';
import logger from '../utils/logger.js';
import { truncateText } from '../utils/helpers.js';

let openaiClient = null;

/**
 * Initialize the OpenAI client
 * @returns {OpenAI}
 */
function getOpenAIClient() {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey === 'your_openai_key_here') {
            throw new Error(
                '❌ OPENAI_API_KEY not configured!\n' +
                '   Run "npm run setup" or add your key to .env file.\n' +
                '   Get your key at: https://platform.openai.com/api-keys'
            );
        }
        openaiClient = new OpenAI({ apiKey });
    }
    return openaiClient;
}

/**
 * Rewrite resume for a specific job description using AI
 * @param {object} parsedResume - Parsed resume { rawText, sections }
 * @param {object} job - Normalized job object
 * @returns {object} - { tailoredSummary, matchingSkills, keywordsUsed }
 */
export async function rewriteResumeForJob(parsedResume, job) {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // Truncate inputs to manage token usage
    const resumeText = truncateText(parsedResume.rawText, 3000);
    const jobDescription = truncateText(job.description, 2000);

    const systemPrompt = `You are a professional resume optimization expert. Your task is to tailor a candidate's resume for a specific job posting.

RULES:
- Only REPHRASE existing experience — NEVER fabricate or add false information
- Use keywords from the job description naturally
- Quantify achievements where possible
- Keep the tone professional and concise
- Focus on relevant experience and skills that match the job
- Output MUST be valid JSON`;

    const userPrompt = `## Candidate's Resume:
${resumeText}

## Target Job:
**Title:** ${job.title}
**Company:** ${job.company}
**Description:** ${jobDescription}

## Instructions:
Generate a tailored version with these fields:
1. "tailoredSummary" — A 3-4 sentence professional summary rewritten to highlight relevance to this specific job (150-200 words max)
2. "matchingSkills" — Comma-separated list of the candidate's skills that match this job's requirements (max 10 skills)
3. "keywordsUsed" — Key terms from the job description that were incorporated
4. "matchScore" — A score from 1-10 indicating how well the candidate matches this job

Return ONLY valid JSON with these 4 fields.`;

    try {
        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('Empty response from OpenAI');

        const result = JSON.parse(content);

        return {
            tailoredSummary: result.tailoredSummary || '',
            matchingSkills: result.matchingSkills || '',
            keywordsUsed: result.keywordsUsed || '',
            matchScore: result.matchScore || 0,
        };
    } catch (error) {
        logger.error(`   ❌ AI rewrite failed for "${job.title}" at ${job.company}: ${error.message}`);

        // Fallback: return original summary
        return {
            tailoredSummary: parsedResume.sections?.summary || 'Resume rewrite failed — use original resume',
            matchingSkills: parsedResume.sections?.skills || '',
            keywordsUsed: '',
            matchScore: 0,
        };
    }
}

/**
 * Rewrite resumes for all jobs with concurrency control
 * @param {object} parsedResume - Parsed resume
 * @param {Array} jobs - Array of normalized jobs
 * @param {number} concurrency - Max concurrent API calls (default: 5)
 * @returns {Array} - Jobs enriched with tailored resume data
 */
export async function rewriteResumesForJobs(parsedResume, jobs, concurrency = 5) {
    logger.info(`🤖 Starting AI resume tailoring for ${jobs.length} jobs (concurrency: ${concurrency})...`);
    const startTime = Date.now();

    // Dynamic import of p-limit (ESM only)
    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(concurrency);

    let completed = 0;

    const enrichedJobs = await Promise.all(
        jobs.map(job =>
            limit(async () => {
                const rewriteResult = await rewriteResumeForJob(parsedResume, job);

                completed++;
                if (completed % 10 === 0 || completed === jobs.length) {
                    logger.info(`   📝 Progress: ${completed}/${jobs.length} resumes tailored`);
                }

                return {
                    ...job,
                    tailoredSummary: rewriteResult.tailoredSummary,
                    matchingSkills: rewriteResult.matchingSkills,
                    keywordsUsed: rewriteResult.keywordsUsed,
                    matchScore: rewriteResult.matchScore,
                };
            })
        )
    );

    // Sort by match score (highest first)
    enrichedJobs.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`✅ Resume tailoring complete: ${jobs.length} jobs in ${elapsed}s`);

    return enrichedJobs;
}
