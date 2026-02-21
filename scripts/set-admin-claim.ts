/**
 * Set Firebase Admin Custom Claims
 *
 * One-time script to grant admin privileges to specific users.
 * Admin users can publish/edit templates in the RPA marketplace.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npx ts-node scripts/set-admin-claim.ts <uid>
 *
 * To find a user's UID:
 *   Firebase Console → Authentication → Users → Copy UID
 *
 * What it does:
 *   Sets { admin: true } custom claim on the user's Firebase Auth token.
 *   This is checked by Firestore Security Rules:
 *     allow write: if request.auth.token.admin == true;
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const uid = process.argv[2];

if (!uid) {
    console.error('Usage: npx ts-node scripts/set-admin-claim.ts <firebase-uid>');
    console.error('Example: npx ts-node scripts/set-admin-claim.ts abc123def456');
    process.exit(1);
}

// Initialize with service account credentials
const app = initializeApp({
    projectId: 'angulogin-com',
});
const auth = getAuth(app);

async function setAdminClaim() {
    try {
        // Verify user exists
        const user = await auth.getUser(uid);
        console.log(`Found user: ${user.email || user.uid}`);

        // Set admin custom claim
        await auth.setCustomUserClaims(uid, { admin: true });

        // Verify
        const updated = await auth.getUser(uid);
        console.log(`Custom claims set:`, updated.customClaims);
        console.log(`\nAdmin claim set for ${user.email || uid}.`);
        console.log('User must sign out and back in for claims to take effect.');
    } catch (err) {
        console.error('Failed to set admin claim:', err);
        process.exit(1);
    }
}

setAdminClaim();
