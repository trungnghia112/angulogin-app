/**
 * Seed RPA Templates to Firestore
 *
 * Usage:
 *   npx ts-node scripts/seed-rpa-templates.ts              # Production (requires GOOGLE_APPLICATION_CREDENTIALS)
 *   npx ts-node scripts/seed-rpa-templates.ts --emulator   # Local emulator (localhost:8080)
 *
 * Creates:
 * 1. rpa-catalog/index  — lightweight catalog with all template summaries
 * 2. rpa-templates/{id} — full detail for each template
 *
 * Status detection:
 * - Templates with selectors/jsExpression/url/waitMs -> "published"
 * - Templates without implementation details -> "draft" (hidden from marketplace)
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const useEmulator = process.argv.includes('--emulator');

if (useEmulator) {
    process.env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080';
    console.log('Using Firestore Emulator at localhost:8080\n');
}

// Initialize Firebase Admin
const app = initializeApp({
    projectId: 'angulogin-com',
});
const db = getFirestore(app);

interface TemplateStep {
    order: number;
    action: string;
    description: string;
    selector?: string;
    jsExpression?: string;
    url?: string;
    waitMs?: number;
    fallbackSelectors?: string[];
    waitForSelector?: string;
    timeout?: number;
    humanDelay?: [number, number];
    iterations?: number;
    value?: string;
}

interface Template {
    id: string;
    version: string;
    metadata: {
        title: string;
        description: string;
        longDescription?: string;
        platform: string;
        platformIcon: string;
        author: string;
        tags: string[];
        createdAt: string;
        updatedAt: string;
        isPremium: boolean;
    };
    stats: { usageCount: number };
    requirements: { note: string; extensions?: string[] };
    overview: string;
    steps: TemplateStep[];
    variables: { name: string; type: string; required: boolean; default?: unknown; description: string }[];
}

type TemplateStatus = 'published' | 'draft';

/** Detect if a template has real implementation (selectors, JS, URLs) */
function detectStatus(template: Template): TemplateStatus {
    return template.steps.some(
        s => s.selector || s.jsExpression || s.url || s.waitMs,
    )
        ? 'published'
        : 'draft';
}

async function seed() {
    const templatesPath = resolve(__dirname, '../src/assets/rpa-templates/templates.json');
    const templates: Template[] = JSON.parse(readFileSync(templatesPath, 'utf-8'));

    console.log(`Found ${templates.length} templates to seed\n`);

    let published = 0;
    let draft = 0;

    // Build catalog entries with status
    const catalogEntries = templates.map(t => {
        const status = detectStatus(t);
        if (status === 'published') published++;
        else draft++;

        return {
            id: t.id,
            title: t.metadata.title,
            description: t.metadata.description,
            platform: t.metadata.platform,
            platformIcon: t.metadata.platformIcon,
            author: t.metadata.author,
            tags: t.metadata.tags,
            isPremium: t.metadata.isPremium,
            usageCount: t.stats.usageCount,
            version: t.version,
            updatedAt: t.metadata.updatedAt,
            status,
        };
    });

    console.log(`  Published: ${published}`);
    console.log(`  Draft:     ${draft}\n`);

    // Write catalog index (1 document)
    const catalogRef = db.collection('rpa-catalog').doc('index');
    await catalogRef.set({
        version: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
        templates: catalogEntries,
    });
    console.log('Wrote rpa-catalog/index');

    // Write individual template details (batched)
    const batch = db.batch();
    for (const t of templates) {
        const status = detectStatus(t);
        const ref = db.collection('rpa-templates').doc(t.id);
        batch.set(ref, {
            ...t,
            status,
        });
    }
    await batch.commit();
    console.log(`Wrote ${templates.length} documents to rpa-templates/`);

    console.log(`\nSeed complete! (${useEmulator ? 'emulator' : 'production'})`);
}

seed().catch(console.error);
