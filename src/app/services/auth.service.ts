import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
    Auth, User,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithPopup, GoogleAuthProvider,
    signOut, sendPasswordResetEmail,
    updateProfile, onAuthStateChanged,
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

    /** Login with Google popup */
    async loginWithGoogle(): Promise<void> {
        this._loading.set(true);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(this.auth, provider);
            await this.updateLastLogin();
            this.router.navigate(['/browsers']);
        } finally {
            this._loading.set(false);
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
