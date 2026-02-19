/**
 * Seed RPA Templates to Firestore
 *
 * Usage: npx ts-node scripts/seed-rpa-templates.ts
 *
 * Creates:
 * 1. rpa-catalog/index — lightweight catalog with all template summaries
 * 2. rpa-templates/{id} — full detail for each template
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Initialize Firebase Admin
// Uses GOOGLE_APPLICATION_CREDENTIALS env var or default service account
const app = initializeApp({
    projectId: 'angulogin-com',
});
const db = getFirestore(app);

interface Template {
    id: string;
    version: string;
    metadata: {
        title: string;
        description: string;
        platform: string;
        platformIcon: string;
        author: string;
        tags: string[];
        createdAt: string;
        updatedAt: string;
        isPremium: boolean;
    };
    stats: { usageCount: number };
    requirements: { note: string };
    overview: string;
    steps: { order: number; action: string; description: string }[];
    variables: { name: string; type: string; required: boolean; default?: unknown; description: string }[];
}

async function seed() {
    const templatesPath = resolve(__dirname, '../src/assets/rpa-templates/templates.json');
    const templates: Template[] = JSON.parse(readFileSync(templatesPath, 'utf-8'));

    console.log(`Found ${templates.length} templates to seed\n`);

    // Build catalog index (lightweight summaries)
    const catalogEntries = templates.map(t => ({
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
    }));

    // Write catalog index (1 document)
    const catalogRef = db.collection('rpa-catalog').doc('index');
    await catalogRef.set({
        version: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
        templates: catalogEntries,
    });
    console.log('Wrote rpa-catalog/index');

    // Write individual template details
    const batch = db.batch();
    for (const t of templates) {
        const ref = db.collection('rpa-templates').doc(t.id);
        batch.set(ref, {
            id: t.id,
            version: t.version,
            metadata: t.metadata,
            stats: t.stats,
            requirements: t.requirements,
            overview: t.overview,
            steps: t.steps,
            variables: t.variables,
        });
    }
    await batch.commit();
    console.log(`Wrote ${templates.length} documents to rpa-templates/`);

    console.log('\nSeed complete!');
}

seed().catch(console.error);
