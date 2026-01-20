import { Injectable, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { BrowserType, Profile, ProfileMetadata } from '../models/profile.model';

@Injectable({
    providedIn: 'root',
})
export class ProfileService {
    readonly profiles = signal<Profile[]>([]);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    async scanProfiles(path: string): Promise<Profile[]> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const names = await invoke<string[]>('scan_profiles', { path });

            // Build profiles with metadata and running status
            const profiles: Profile[] = await Promise.all(
                names.map(async (name) => {
                    const profilePath = `${path}/${name}`;
                    const [metadata, isRunning] = await Promise.all([
                        this.getProfileMetadata(profilePath),
                        this.isProfileRunning(profilePath),
                    ]);
                    return { name, path: profilePath, metadata, isRunning };
                })
            );

            this.profiles.set(profiles);
            return profiles;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        } finally {
            this.loading.set(false);
        }
    }

    async launchChrome(profilePath: string): Promise<void> {
        try {
            await invoke('launch_chrome', { profilePath });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async checkPathExists(path: string): Promise<boolean> {
        try {
            return await invoke<boolean>('check_path_exists', { path });
        } catch {
            return false;
        }
    }

    async createProfile(basePath: string, name: string): Promise<string> {
        try {
            const newPath = await invoke<string>('create_profile', { basePath, name });
            await this.scanProfiles(basePath);
            return newPath;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async deleteProfile(profilePath: string, basePath: string): Promise<void> {
        try {
            await invoke('delete_profile', { profilePath });
            await this.scanProfiles(basePath);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async renameProfile(oldPath: string, newName: string, basePath: string): Promise<string> {
        try {
            const newPath = await invoke<string>('rename_profile', { oldPath, newName });
            await this.scanProfiles(basePath);
            return newPath;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async getProfileMetadata(profilePath: string): Promise<ProfileMetadata> {
        try {
            return await invoke<ProfileMetadata>('get_profile_metadata', { profilePath });
        } catch {
            return { emoji: null, notes: null, group: null, shortcut: null, browser: null };
        }
    }

    async saveProfileMetadata(
        profilePath: string,
        emoji: string | null,
        notes: string | null,
        group: string | null,
        shortcut: number | null,
        browser: string | null,
    ): Promise<void> {
        try {
            await invoke('save_profile_metadata', { profilePath, emoji, notes, group, shortcut, browser });
            this.profiles.update((profiles) =>
                profiles.map((p) =>
                    p.path === profilePath ? { ...p, metadata: { emoji, notes, group, shortcut, browser: browser as BrowserType | null } } : p
                )
            );
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async isProfileRunning(profilePath: string): Promise<boolean> {
        try {
            return await invoke<boolean>('is_chrome_running_for_profile', { profilePath });
        } catch {
            return false;
        }
    }

    async refreshProfileStatus(): Promise<void> {
        const current = this.profiles();
        const updated = await Promise.all(
            current.map(async (p) => ({
                ...p,
                isRunning: await this.isProfileRunning(p.path),
            }))
        );
        this.profiles.set(updated);
    }

    async launchBrowser(profilePath: string, browser: string): Promise<void> {
        try {
            await invoke('launch_browser', { profilePath, browser });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async getProfileSize(profilePath: string): Promise<number> {
        try {
            return await invoke<number>('get_profile_size', { profilePath });
        } catch {
            return 0;
        }
    }

    async listAvailableBrowsers(): Promise<string[]> {
        try {
            return await invoke<string[]>('list_available_browsers');
        } catch {
            return ['chrome'];
        }
    }
}
