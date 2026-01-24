/**
 * Script to update HTML templates for dark mode compatibility
 * Replaces bg-surface-X with bg-surface-X dark:bg-surface-Y pattern
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const replacements = [
    // Surface backgrounds - need dark variants
    // surface-0 (white) -> dark should use surface-900 (dark gray)
    { from: /\bbg-surface-0\b(?!\s+dark:)/g, to: 'bg-surface-0 dark:bg-surface-900' },

    // surface-50 (very light) -> dark should use surface-950 (very dark)
    { from: /\bbg-surface-50\b(?!\s+dark:)/g, to: 'bg-surface-50 dark:bg-surface-950' },

    // surface-100 (light) -> dark should use surface-800
    { from: /\bbg-surface-100\b(?!\s+dark:)/g, to: 'bg-surface-100 dark:bg-surface-800' },

    // border-surface-200 (light border) -> dark should use surface-700
    { from: /\bborder-surface-200\b(?!\s+dark:)/g, to: 'border-surface-200 dark:border-surface-700' },
];

function processFile(filePath) {
    let content = readFileSync(filePath, 'utf8');
    let hasChanges = false;

    for (const { from, to } of replacements) {
        const newContent = content.replace(from, to);
        if (newContent !== content) {
            content = newContent;
            hasChanges = true;
        }
    }

    if (hasChanges) {
        writeFileSync(filePath, content);
        console.log(`Updated: ${filePath}`);
    }
}

function walkDir(dir) {
    const files = readdirSync(dir);
    for (const file of files) {
        const filePath = join(dir, file);
        const stat = statSync(filePath);
        if (stat.isDirectory() && !filePath.includes('node_modules')) {
            walkDir(filePath);
        } else if (file.endsWith('.html')) {
            processFile(filePath);
        }
    }
}

walkDir('src');
console.log('Done!');
