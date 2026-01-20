import { Injectable, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { Profile } from '../models/profile.model';

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
            const profiles: Profile[] = names.map((name) => ({
                name,
                path: `${path}/${name}`,
            }));
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
}
