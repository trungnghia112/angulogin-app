import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
    Auth, User,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithPopup, signInWithRedirect, getRedirectResult,
    GoogleAuthProvider, EmailAuthProvider,
    signOut, sendPasswordResetEmail,
    updateProfile, updatePassword, reauthenticateWithCredential,
    onAuthStateChanged,
} from '@angular/fire/auth';
import {
    Firestore, doc, getDoc, setDoc, updateDoc,
    Timestamp,
} from '@angular/fire/firestore';
import { UserProfile, PlanTier, PLAN_CONFIG } from '../core/models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly auth = inject(Auth);
    private readonly firestore = inject(Firestore);
    private readonly router = inject(Router);

    /** Firebase Auth user */
    private readonly _user = signal<User | null>(null);
    readonly user = this._user.asReadonly();

    /** Firestore user profile */
    private readonly _profile = signal<UserProfile | null>(null);
    readonly profile = this._profile.asReadonly();

    /** Auth state resolved (first onAuthStateChanged fired) */
    private readonly _authReady = signal(false);
    readonly authReady = this._authReady.asReadonly();

    /** Loading state for auth actions */
    private readonly _loading = signal(false);
    readonly loading = this._loading.asReadonly();

    readonly isLoggedIn = computed(() => !!this._user());
    readonly displayName = computed(() => this._profile()?.displayName || this._user()?.displayName || 'User');
    readonly photoURL = computed(() => this._profile()?.photoURL || this._user()?.photoURL || null);
    readonly initial = computed(() => this.displayName().charAt(0).toUpperCase());
    readonly currentPlan = computed<PlanTier>(() => this._profile()?.plan || 'trial');
    readonly isPasswordUser = computed(() => {
        const user = this._user();
        return user?.providerData?.some(p => p.providerId === 'password') ?? false;
    });

    constructor() {
        onAuthStateChanged(this.auth, async (user) => {
            this._user.set(user);
            if (user) {
                await this.loadOrCreateProfile(user);
            } else {
                this._profile.set(null);
            }
            this._authReady.set(true);
        });

        // Handle redirect result (for Tauri WebView Google login fallback)
        getRedirectResult(this.auth).then(async (result) => {
            if (result?.user) {
                await this.updateLastLogin();
                this.router.navigate(['/browsers']);
            }
        }).catch(() => { /* no redirect result — normal flow */ });
    }

    /** Login with email + password */
    async login(email: string, password: string): Promise<void> {
        this._loading.set(true);
        try {
            await signInWithEmailAndPassword(this.auth, email, password);
            await this.updateLastLogin();
            this.router.navigate(['/browsers']);
        } finally {
            this._loading.set(false);
        }
    }

    /** Register with email + password */
    async register(email: string, password: string, displayName: string): Promise<void> {
        this._loading.set(true);
        try {
            const cred = await createUserWithEmailAndPassword(this.auth, email, password);
            await updateProfile(cred.user, { displayName });
            await this.createUserProfile(cred.user, displayName);
            this.router.navigate(['/browsers']);
        } finally {
            this._loading.set(false);
        }
    }

    /** Login with Google — uses system browser in Tauri, popup in browser */
    async loginWithGoogle(): Promise<void> {
        this._loading.set(true);
        try {
            const provider = new GoogleAuthProvider();

            // Check if running in Tauri (window.__TAURI__ exists)
            if ((window as any).__TAURI__) {
                await this.loginWithGoogleTauri();
            } else {
                // Standard browser — use popup
                await signInWithPopup(this.auth, provider);
                await this.updateLastLogin();
                this.router.navigate(['/browsers']);
            }
        } finally {
            this._loading.set(false);
        }
    }

    /** Google OAuth via system browser for Tauri desktop app */
    private async loginWithGoogleTauri(): Promise<void> {
        const { invoke } = await import('@tauri-apps/api/core');
        const { open } = await import('@tauri-apps/plugin-shell');
        const { listen } = await import('@tauri-apps/api/event');

        // 1. Start local OAuth callback server in Rust
        const redirectUri: string = await invoke('oauth_start_google');

        // 2. Build Google OAuth URL
        const { firebase } = (await import('../../environments/environment')).environment;
        const params = new URLSearchParams({
            client_id: firebase.apiKey.includes('AIza')
                ? `${firebase.messagingSenderId}-compute@developer.gserviceaccount.com`
                : '',
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'offline',
            prompt: 'select_account',
        });

        // Use Firebase Auth's OAuth handler instead of raw Google OAuth
        // This works because Firebase Auth handles the token exchange
        const authUrl = `https://${firebase.authDomain}/__/auth/handler?` +
            `apiKey=${firebase.apiKey}&authType=signInViaRedirect&providerId=google.com&` +
            `redirectUrl=${encodeURIComponent(redirectUri)}&v=10&scopes=profile%20email`;

        // 3. Open in system browser
        await open(authUrl);

        // 4. Wait for callback from Rust (with timeout)
        const authCode = await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('OAuth timeout (60s)')), 60000);

            listen<string>('oauth-callback', (event) => {
                clearTimeout(timeout);
                resolve(event.payload);
            });

            listen<string>('oauth-callback-error', (event) => {
                clearTimeout(timeout);
                reject(new Error(event.payload));
            });
        });

        // 5. Exchange auth code for Firebase credential
        // Use signInWithCredential with the Google OAuth credential
        const { OAuthProvider, signInWithCredential: signInCred } = await import('@angular/fire/auth');
        const credential = OAuthProvider.credentialFromJSON({
            providerId: 'google.com',
            signInMethod: 'google.com',
            oauthAccessToken: authCode,
        });
        if (credential) {
            await signInCred(this.auth, credential);
            await this.updateLastLogin();
            this.router.navigate(['/browsers']);
        }
    }

    /** Send password reset email */
    async forgotPassword(email: string): Promise<void> {
        this._loading.set(true);
        try {
            await sendPasswordResetEmail(this.auth, email);
        } finally {
            this._loading.set(false);
        }
    }

    /** Logout */
    async logout(): Promise<void> {
        await signOut(this.auth);
        this._profile.set(null);
        this.router.navigate(['/login']);
    }

    /** Update display name (Firebase Auth + Firestore) */
    async updateDisplayName(name: string): Promise<void> {
        const user = this._user();
        if (!user) throw new Error('Not authenticated');
        await updateProfile(user, { displayName: name });
        const ref = doc(this.firestore, 'users', user.uid);
        await updateDoc(ref, { displayName: name });
        const current = this._profile();
        if (current) this._profile.set({ ...current, displayName: name });
    }

    /** Update photo URL (Firebase Auth + Firestore) */
    async updatePhotoURL(url: string | null): Promise<void> {
        const user = this._user();
        if (!user) throw new Error('Not authenticated');
        await updateProfile(user, { photoURL: url });
        const ref = doc(this.firestore, 'users', user.uid);
        await updateDoc(ref, { photoURL: url || null });
        const current = this._profile();
        if (current) this._profile.set({ ...current, photoURL: url || null });
    }

    /** Change password (re-authenticate first, then update) */
    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        const user = this._user();
        if (!user || !user.email) throw new Error('Not authenticated');
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
    }

    /** Wait for auth state to resolve (used by guard) */
    waitForAuthReady(): Promise<void> {
        if (this._authReady()) return Promise.resolve();
        return new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(this.auth, () => {
                unsubscribe();
                resolve();
            });
        });
    }

    // --- Private ---

    private async loadOrCreateProfile(user: User): Promise<void> {
        const ref = doc(this.firestore, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            this._profile.set(snap.data() as UserProfile);
        } else {
            await this.createUserProfile(user, user.displayName || 'User');
        }
    }

    private async createUserProfile(user: User, displayName: string): Promise<void> {
        const defaultPlan: PlanTier = 'trial';
        const profile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName,
            photoURL: user.photoURL || null,
            plan: defaultPlan,
            planExpiry: null,
            profileLimit: PLAN_CONFIG[defaultPlan].profileLimit,
            createdAt: Timestamp.now(),
            lastLoginAt: Timestamp.now(),
        };
        const ref = doc(this.firestore, 'users', user.uid);
        await setDoc(ref, profile);
        this._profile.set(profile);
    }

    private async updateLastLogin(): Promise<void> {
        const user = this._user();
        if (!user) return;
        const ref = doc(this.firestore, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            await updateDoc(ref, { lastLoginAt: Timestamp.now() });
            this._profile.set({ ...snap.data(), lastLoginAt: Timestamp.now() } as UserProfile);
        } else {
            await this.createUserProfile(user, user.displayName || 'User');
        }
    }
}
