// ============================================
// Run Once — Manual single pipeline execution
// ============================================
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

// Check if .env exists
if (!fs.existsSync(path.join(ROOT_DIR, '.env'))) {
    console.error('');
    console.error('❌ No .env file found!');
    console.error('   Run "npm run setup" first to configure the scraper.');
    console.error('');
    process.exit(1);
}

// Check if resume exists
const resumeDir = path.join(ROOT_DIR, 'resume');
if (!fs.existsSync(resumeDir) || fs.readdirSync(resumeDir).filter(f => f.endsWith('.pdf')).length === 0) {
    console.error('');
    console.error('❌ No resume.pdf found in the "resume/" folder!');
    console.error('   Place your resume PDF in the "resume/" folder and try again.');
    console.error('');
    process.exit(1);
}

console.log('');
console.log('╔═══════════════════════════════════════════════════╗');
console.log('║        🚀 JOB SCRAPER — ONE-TIME RUN              ║');
console.log('╚═══════════════════════════════════════════════════╝');
console.log('');

// Dynamic import to avoid loading everything at startup
const { runPipeline } = await import('../src/index.js');

try {
    const result = await runPipeline();
    
    if (result.outputFile) {
        console.log('');
        console.log(`📁 Open your Excel file: ${result.outputFile}`);
    }

    process.exit(0);
} catch (error) {
    console.error('');
    console.error(`❌ Pipeline failed: ${error.message}`);
    process.exit(1);
}
