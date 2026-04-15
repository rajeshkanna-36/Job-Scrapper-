// ============================================
// Excel Generator — Styled .xlsx output
// ============================================
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';
import { truncateText, getDateString } from '../utils/helpers.js';

// Site brand colors
const SITE_COLORS = {
    LinkedIn: { bg: 'FF0A66C2', font: 'FFFFFFFF' },
    Indeed: { bg: 'FF2164F3', font: 'FFFFFFFF' },
    Glassdoor: { bg: 'FF0CAA41', font: 'FFFFFFFF' },
    Naukri: { bg: 'FF4A90D9', font: 'FFFFFFFF' },
    RemoteOK: { bg: 'FFFF4742', font: 'FFFFFFFF' },
    Default: { bg: 'FF6C757D', font: 'FFFFFFFF' },
};

// Status colors for conditional formatting
const STATUS_FILL = {
    Applied: { bg: 'FF28A745' },
    Interview: { bg: 'FFFFC107' },
    Rejected: { bg: 'FFDC3545' },
    Skipped: { bg: 'FF6C757D' },
};

/**
 * Generate a styled Excel file with job data
 * @param {Array} enrichedJobs - Jobs with tailored resume data
 * @param {object} options - Output options
 * @returns {string} - Path to generated Excel file
 */
export async function generateExcel(enrichedJobs, options = {}) {
    const {
        outputDir = process.env.OUTPUT_DIR || './output',
        filenamePattern = 'jobs_{date}.xlsx',
        maxDescriptionLength = 500,
    } = options;

    // Ensure output directory exists
    const resolvedDir = path.resolve(outputDir);
    if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
    }

    // Generate filename
    const dateStr = getDateString();
    const filename = filenamePattern.replace('{date}', dateStr);
    const outputPath = path.join(resolvedDir, filename);

    logger.info(`📊 Generating Excel: ${filename} (${enrichedJobs.length} jobs)...`);

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Job Scraper';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(`Jobs — ${dateStr}`, {
        properties: { defaultRowHeight: 20 },
        views: [{ state: 'frozen', ySplit: 1 }], // Freeze header row
    });

    // ── Define Columns ──────────────────────────────
    worksheet.columns = [
        { header: '#', key: 'serial', width: 5 },
        { header: '⭐ Score', key: 'matchScore', width: 8 },
        { header: 'Job Title', key: 'title', width: 35 },
        { header: 'Company', key: 'company', width: 25 },
        { header: 'Location', key: 'location', width: 20 },
        { header: 'Type', key: 'jobType', width: 12 },
        { header: 'Remote', key: 'remote', width: 10 },
        { header: 'Salary', key: 'salary', width: 18 },
        { header: 'Posted', key: 'postedDate', width: 18 },
        { header: 'Source', key: 'source', width: 12 },
        { header: 'Job Description', key: 'description', width: 50 },
        { header: 'Tailored Resume Summary', key: 'tailoredSummary', width: 55 },
        { header: 'Matching Skills', key: 'matchingSkills', width: 35 },
        { header: '🔗 Apply Link', key: 'applyUrl', width: 45 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Notes', key: 'notes', width: 20 },
    ];

    // ── Style Header Row ────────────────────────────
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
        cell.font = {
            bold: true,
            color: { argb: 'FFFFFFFF' },
            size: 11,
            name: 'Segoe UI',
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1A1A2E' },
        };
        cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true,
        };
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FF6C3FC5' } },
        };
    });

    // ── Add Data Rows ───────────────────────────────
    for (let i = 0; i < enrichedJobs.length; i++) {
        const job = enrichedJobs[i];
        const row = worksheet.addRow({
            serial: i + 1,
            matchScore: job.matchScore || '—',
            title: job.title,
            company: job.company,
            location: job.location,
            jobType: job.jobType || '—',
            remote: job.remote || '—',
            salary: job.salary || '—',
            postedDate: formatPostedDate(job.postedDate),
            source: job.source,
            description: truncateText(job.description, maxDescriptionLength),
            tailoredSummary: job.tailoredSummary || '',
            matchingSkills: job.matchingSkills || '',
            applyUrl: job.applyUrl || '',
            status: '',
            notes: '',
        });

        // Row styling
        const isEven = i % 2 === 0;
        row.eachCell((cell, colNumber) => {
            // Alternating row colors
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEven ? 'FFF8F9FA' : 'FFFFFFFF' },
            };

            cell.font = {
                size: 10,
                name: 'Segoe UI',
            };

            cell.alignment = {
                vertical: 'top',
                wrapText: true,
            };

            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            };
        });

        // ── Special Cell Styling ────────────────────

        // Match Score — color-coded
        const scoreCell = row.getCell('matchScore');
        const score = job.matchScore || 0;
        if (score >= 8) {
            scoreCell.font = { bold: true, color: { argb: 'FF28A745' }, size: 11, name: 'Segoe UI' };
        } else if (score >= 5) {
            scoreCell.font = { bold: true, color: { argb: 'FFFFC107' }, size: 11, name: 'Segoe UI' };
        } else {
            scoreCell.font = { bold: true, color: { argb: 'FFDC3545' }, size: 11, name: 'Segoe UI' };
        }
        scoreCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Job Title — bold
        const titleCell = row.getCell('title');
        titleCell.font = { bold: true, size: 10, name: 'Segoe UI', color: { argb: 'FF1A1A2E' } };

        // Source — color-coded pill
        const sourceCell = row.getCell('source');
        const siteColor = SITE_COLORS[job.source] || SITE_COLORS.Default;
        sourceCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: siteColor.bg },
        };
        sourceCell.font = {
            bold: true,
            color: { argb: siteColor.font },
            size: 9,
            name: 'Segoe UI',
        };
        sourceCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Apply Link — clickable hyperlink
        const linkCell = row.getCell('applyUrl');
        if (job.applyUrl && job.applyUrl.startsWith('http')) {
            linkCell.value = {
                text: 'Apply Here →',
                hyperlink: job.applyUrl,
            };
            linkCell.font = {
                color: { argb: 'FF0A66C2' },
                underline: true,
                size: 10,
                name: 'Segoe UI',
            };
        }

        // Status column — dropdown validation
        const statusCell = row.getCell('status');
        statusCell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"Applied,Interview,Rejected,Skipped,Saved"'],
            showErrorMessage: true,
            errorTitle: 'Invalid Status',
            error: 'Please select: Applied, Interview, Rejected, Skipped, or Saved',
        };
        statusCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Tailored Summary — slightly different bg to stand out
        const summaryCell = row.getCell('tailoredSummary');
        summaryCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'FFEEF6FF' : 'FFF5F0FF' },
        };

        // Row height for readability
        row.height = Math.max(25, Math.min(80, Math.ceil((job.tailoredSummary || '').length / 60) * 15));
    }

    // ── Auto-filter on all columns ──────────────────
    worksheet.autoFilter = {
        from: 'A1',
        to: `P${enrichedJobs.length + 1}`,
    };

    // ── Add Summary Sheet ───────────────────────────
    const summarySheet = workbook.addWorksheet('Summary', {
        properties: { defaultRowHeight: 22 },
    });

    summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 30 },
    ];

    // Style summary header
    const summaryHeader = summarySheet.getRow(1);
    summaryHeader.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Segoe UI' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C3FC5' } };
    });

    const summaryData = [
        { metric: '📅 Date', value: getDateString('readable') },
        { metric: '📊 Total Jobs Found', value: enrichedJobs.length },
        { metric: '', value: '' },
    ];

    // Source breakdown
    const sourceCounts = {};
    for (const job of enrichedJobs) {
        sourceCounts[job.source] = (sourceCounts[job.source] || 0) + 1;
    }
    for (const [source, count] of Object.entries(sourceCounts)) {
        summaryData.push({ metric: `   ${source}`, value: count });
    }

    summaryData.push({ metric: '', value: '' });

    // Top match scores
    const avgScore = enrichedJobs.length > 0
        ? (enrichedJobs.reduce((sum, j) => sum + (j.matchScore || 0), 0) / enrichedJobs.length).toFixed(1)
        : 0;
    summaryData.push({ metric: '⭐ Average Match Score', value: `${avgScore}/10` });
    summaryData.push({ metric: '🏆 High Match (8+)', value: enrichedJobs.filter(j => (j.matchScore || 0) >= 8).length });
    summaryData.push({ metric: '✅ Medium Match (5-7)', value: enrichedJobs.filter(j => (j.matchScore || 0) >= 5 && (j.matchScore || 0) < 8).length });
    summaryData.push({ metric: '⚠ Low Match (<5)', value: enrichedJobs.filter(j => (j.matchScore || 0) < 5).length });

    for (const row of summaryData) {
        summarySheet.addRow(row);
    }

    // ── Write File ──────────────────────────────────
    await workbook.xlsx.writeFile(outputPath);

    logger.info(`✅ Excel saved: ${outputPath}`);
    return outputPath;
}

/**
 * Format posted date for display
 * @param {string} dateStr - ISO date string
 * @returns {string} - Formatted date string
 */
function formatPostedDate(dateStr) {
    if (!dateStr) return 'Unknown';

    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;

        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}
