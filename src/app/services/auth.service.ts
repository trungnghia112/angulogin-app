import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
    Auth, User,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithPopup, signInWithCredential,
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

    /** Login with Google — popup in browser, system browser in Tauri */
    async loginWithGoogle(): Promise<void> {
        this._loading.set(true);
        try {
            // Tauri 2.x detection
            if ('__TAURI_INTERNALS__' in window) {
                await this.loginWithGoogleViaBrowser();
            } else {
                const provider = new GoogleAuthProvider();
                await signInWithPopup(this.auth, provider);
                await this.updateLastLogin();
                this.router.navigate(['/browsers']);
            }
        } finally {
            this._loading.set(false);
        }
    }

    /**
     * Google OAuth via system browser for Tauri desktop.
     * Opens Google consent screen in Safari/Chrome, Rust captures the token.
     */
    private async loginWithGoogleViaBrowser(): Promise<void> {
        const { invoke } = await import('@tauri-apps/api/core');
        const { open } = await import('@tauri-apps/plugin-shell');
        const { listen } = await import('@tauri-apps/api/event');
        const { environment } = await import('../../environments/environment');

        // 1. Start Rust callback server (port 8923)
        const redirectUri: string = await invoke('oauth_start_google');

        // 2. Open Google OAuth in system browser
        const oauthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
            new URLSearchParams({
                client_id: environment.firebase.googleClientId,
                redirect_uri: redirectUri,
                response_type: 'token',
                scope: 'openid email profile',
                prompt: 'select_account',
            }).toString();

        await open(oauthUrl);

        // 3. Wait for Rust callback event (cleanup listeners on resolve/reject)
        const accessToken = await new Promise<string>((resolve, reject) => {
            let unlistenOk: (() => void) | null = null;
            let unlistenErr: (() => void) | null = null;
            const timeout = setTimeout(() => {
                unlistenOk?.();
                unlistenErr?.();
                reject(new Error('Google login timed out (120s). Please try again.'));
            }, 120_000);

            const cleanup = () => {
                clearTimeout(timeout);
                unlistenOk?.();
                unlistenErr?.();
            };

            listen<string>('oauth-callback', (e) => {
                cleanup();
                resolve(e.payload);
            }).then(fn => { unlistenOk = fn; });

            listen<string>('oauth-callback-error', (e) => {
                cleanup();
                reject(new Error(e.payload));
            }).then(fn => { unlistenErr = fn; });
        });

        // 4. Exchange access token for Firebase credential
        const credential = GoogleAuthProvider.credential(null, accessToken);
        await signInWithCredential(this.auth, credential);
        await this.updateLastLogin();
        this.router.navigate(['/browsers']);
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
            // Sync auth profile data (photoURL, displayName) on each login
            const updates: Record<string, unknown> = { lastLoginAt: Timestamp.now() };
            const data = snap.data() as UserProfile;
            if (user.photoURL && user.photoURL !== data.photoURL) {
                updates['photoURL'] = user.photoURL;
            }
            if (user.displayName && user.displayName !== data.displayName) {
                updates['displayName'] = user.displayName;
            }
            await updateDoc(ref, updates);
            this._profile.set({ ...data, ...updates } as UserProfile);
        } else {
            await this.createUserProfile(user, user.displayName || 'User');
        }
    }
}
