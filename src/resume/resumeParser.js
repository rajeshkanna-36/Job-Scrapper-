// ============================================
// Resume Parser — PDF to structured text
// ============================================
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

// pdf-parse v2 uses a class-based API
let PDFParse;

/**
 * Parse a resume PDF file and extract structured text
 * @param {string} pdfPath - Path to the resume PDF file
 * @returns {object} - { rawText, sections, metadata }
 */
export async function parseResume(pdfPath) {
    // Lazy-load pdf-parse (v2 API)
    if (!PDFParse) {
        const module = await import('pdf-parse');
        PDFParse = module.PDFParse;
    }

    // Validate file exists
    const resolvedPath = path.resolve(pdfPath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Resume file not found: ${resolvedPath}`);
    }

    logger.info(`📄 Parsing resume: ${path.basename(resolvedPath)}`);

    // Read PDF file
    const dataBuffer = fs.readFileSync(resolvedPath);

    // pdf-parse v2: create parser instance and extract text
    const parser = new PDFParse({ data: new Uint8Array(dataBuffer) });
    const pdfData = await parser.getText();

    const rawText = pdfData.text;
    const numPages = pdfData.numPages || 1;

    // Clean up parser resources
    await parser.destroy();

    // Extract sections using common resume headings
    const sections = extractSections(rawText);

    const result = {
        rawText: rawText.trim(),
        sections,
        metadata: {
            pages: numPages,
            fileName: path.basename(resolvedPath),
            parsedAt: new Date().toISOString(),
            charCount: rawText.length,
        },
    };

    logger.info(`✅ Resume parsed: ${result.metadata.pages} page(s), ${result.metadata.charCount} characters`);
    logger.debug(`   Sections found: ${Object.keys(sections).filter(k => sections[k]).join(', ')}`);

    return result;
}

/**
 * Extract common resume sections from raw text
 * @param {string} text - Raw resume text
 * @returns {object} - Extracted sections
 */
function extractSections(text) {
    const sections = {
        summary: '',
        experience: '',
        education: '',
        skills: '',
        projects: '',
        certifications: '',
        fullText: text,
    };

    // Common section header patterns  
    const sectionPatterns = [
        { key: 'summary', patterns: [/(?:professional\s+)?summary|objective|about\s+me|profile/i] },
        { key: 'experience', patterns: [/(?:work\s+)?experience|employment\s+history|work\s+history/i] },
        { key: 'education', patterns: [/education|academic|qualification/i] },
        { key: 'skills', patterns: [/(?:technical\s+)?skills|competenc|technologies|expertise/i] },
        { key: 'projects', patterns: [/projects|portfolio/i] },
        { key: 'certifications', patterns: [/certifications?|licenses?|awards?/i] },
    ];

    // Split text into lines and try to identify sections
    const lines = text.split('\n');
    let currentSection = 'summary'; // Default first section

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Check if this line is a section header
        let isHeader = false;
        for (const { key, patterns } of sectionPatterns) {
            for (const pattern of patterns) {
                // Section headers are typically short lines (< 50 chars) that match a pattern
                if (trimmedLine.length < 50 && pattern.test(trimmedLine)) {
                    currentSection = key;
                    isHeader = true;
                    break;
                }
            }
            if (isHeader) break;
        }

        if (!isHeader) {
            sections[currentSection] += trimmedLine + '\n';
        }
    }

    // Trim all sections
    for (const key of Object.keys(sections)) {
        sections[key] = sections[key].trim();
    }

    return sections;
}

/**
 * Find the resume file in the resume directory
 * @param {string} resumeDir - Path to resume directory
 * @returns {string|null} - Path to resume file or null
 */
export function findResumeFile(resumeDir = './resume') {
    const resolvedDir = path.resolve(resumeDir);

    if (!fs.existsSync(resolvedDir)) {
        return null;
    }

    const files = fs.readdirSync(resolvedDir);
    const pdfFile = files.find(f => f.toLowerCase().endsWith('.pdf'));

    if (pdfFile) {
        return path.join(resolvedDir, pdfFile);
    }

    return null;
}
