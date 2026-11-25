import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { GameState } from '../systems/gameState';
import type { ActivityFeedEntry, LeaderboardEntry, SaveData } from '../types';

export interface CloudUserInfo {
  uid: string;
  email: string | null;
  displayName: string;
  isGoogle: boolean;
}

export function formatDurationSec(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec <= 0) return '—';
  const total = Math.max(1, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatRelativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'gerade eben';
  if (diffSec < 3600) return `vor ${Math.floor(diffSec / 60)} Min.`;
  if (diffSec < 86400) return `vor ${Math.floor(diffSec / 3600)} Std.`;
  return `vor ${Math.floor(diffSec / 86400)} Tg.`;
}

function readFirebaseConfig() {
  const env = import.meta.env;
  const apiKey = (env.VITE_FIREBASE_API_KEY as string | undefined)?.trim();
  const authDomain = (env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined)?.trim();
  const projectId = (env.VITE_FIREBASE_PROJECT_ID as string | undefined)?.trim();
  const storageBucket = (env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined)?.trim();
  const messagingSenderId = (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined)?.trim();
  const appId = (env.VITE_FIREBASE_APP_ID as string | undefined)?.trim();

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: storageBucket || `${projectId}.appspot.com`,
    messagingSenderId: messagingSenderId || '',
    appId,
  };
}

class FirebaseCloudService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;
  private configured = false;

  public currentUser: CloudUserInfo | null = null;
  public lastSyncAt: number | null = null;
  public syncStatus: 'offline' | 'idle' | 'syncing' | 'synced' | 'error' = 'offline';
  public lastError: string | null = null;

  private authListeners = new Set<(user: CloudUserInfo | null) => void>();
  private syncTimer: number | null = null;

  constructor() {
    const cfg = readFirebaseConfig();
    if (!cfg) {
      this.configured = false;
      this.syncStatus = 'offline';
      return;
    }

    try {
      this.app = initializeApp(cfg);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      this.configured = true;
      this.syncStatus = 'idle';

      onAuthStateChanged(this.auth, (user: User | null) => {
        this.currentUser = user ? this.mapUser(user) : null;
        this.syncStatus = user ? 'idle' : 'offline';
        for (const cb of this.authListeners) {
          cb(this.currentUser);
        }
      });
    } catch (err) {
      this.configured = false;
      this.syncStatus = 'error';
      this.lastError = err instanceof Error ? err.message : 'Firebase-Initialisierung fehlgeschlagen';
    }
  }

  private mapUser(u: User): CloudUserInfo {
    const isGoogle = u.providerData.some((p) => p.providerId === 'google.com');
    const fallbackName = u.email ? u.email.split('@')[0] : 'Sternen-Kapitän';
    return {
      uid: u.uid,
      email: u.email,
      displayName: (u.displayName || fallbackName).slice(0, 22),
      isGoogle,
    };
  }

  public isConfigured(): boolean {
    return this.configured;
  }

  public onAuthChange(cb: (user: CloudUserInfo | null) => void): () => void {
    this.authListeners.add(cb);
    cb(this.currentUser);
    return () => this.authListeners.delete(cb);
  }

  public async signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
    if (!this.auth) return { ok: false, error: 'Firebase ist noch nicht konfiguriert.' };
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(this.auth, provider);
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          const provider = new GoogleAuthProvider();
          await signInWithRedirect(this.auth, provider);
          return { ok: true };
        } catch (rErr) {
          return { ok: false, error: this.friendlyAuthError(rErr) };
        }
      }
      return { ok: false, error: this.friendlyAuthError(err) };
    }
  }

  public async signInWithEmail(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.auth) return { ok: false, error: 'Firebase ist noch nicht konfiguriert.' };
    try {
      await signInWithEmailAndPassword(this.auth, email.trim(), password);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.friendlyAuthError(err) };
    }
  }

  public async registerWithEmail(
    email: string,
    password: string,
    captainName: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.auth) return { ok: false, error: 'Firebase ist noch nicht konfiguriert.' };
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
      const cleanName = captainName.trim().slice(0, 22) || email.split('@')[0] || 'Sternen-Kapitän';
      await updateProfile(cred.user, { displayName: cleanName });
      this.currentUser = this.mapUser(cred.user);
      this.currentUser.displayName = cleanName;
      for (const cb of this.authListeners) cb(this.currentUser);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.friendlyAuthError(err) };
    }
  }

  public async updateCaptainName(name: string): Promise<{ ok: boolean; error?: string }> {
    const clean = name.trim().slice(0, 22);
    if (!clean) return { ok: false, error: 'Bitte einen Kapitäns-Namen eingeben.' };
    if (!this.auth?.currentUser) return { ok: true };
    try {
      await updateProfile(this.auth.currentUser, { displayName: clean });
      if (this.currentUser) this.currentUser.displayName = clean;
      for (const cb of this.authListeners) cb(this.currentUser);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.friendlyAuthError(err) };
    }
  }

  public async signOutUser(): Promise<void> {
    if (!this.auth) return;
    await signOut(this.auth);
    this.lastSyncAt = null;
    this.syncStatus = 'offline';
  }

  /** Debounced cloud save + leaderboard update whenever a logged-in player saves locally */
  public scheduleAutoSync(state: GameState): void {
    if (!this.configured || !this.currentUser || !this.db) return;
    if (this.syncTimer !== null) {
      window.clearTimeout(this.syncTimer);
    }
    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = null;
      void this.syncAllToCloud(state);
    }, 1800);
  }

  public async syncAllToCloud(state: GameState): Promise<{ ok: boolean; error?: string }> {
    if (!this.configured || !this.currentUser || !this.db) {
      return { ok: false, error: 'Nicht angemeldet.' };
    }
    this.syncStatus = 'syncing';
    try {
      const now = Date.now();
      const saveJson = state.exportSaveJson();
      await setDoc(
        doc(this.db, 'saves', this.currentUser.uid),
        {
          saveJson,
          day: state.day,
          ngPlusLevel: state.ngPlusLevel,
          totalEarned: state.totalEarned,
          updatedAt: now,
        },
        { merge: true },
      );

      const entry = this.buildLeaderboardEntry(state, this.currentUser.uid, state.captainName || this.currentUser.displayName);
      await setDoc(doc(this.db, 'leaderboard', this.currentUser.uid), entry, { merge: true });

      this.lastSyncAt = now;
      this.syncStatus = 'synced';
      this.lastError = null;
      return { ok: true };
    } catch (err) {
      this.syncStatus = 'error';
      this.lastError = err instanceof Error ? err.message : 'Cloud-Sync fehlgeschlagen';
      return { ok: false, error: this.lastError };
    }
  }

  public async downloadCloudSave(): Promise<{ ok: boolean; saveJson?: string; updatedAt?: number; error?: string }> {
    if (!this.configured || !this.currentUser || !this.db) {
      return { ok: false, error: 'Nicht angemeldet.' };
    }
    try {
      const snap = await getDoc(doc(this.db, 'saves', this.currentUser.uid));
      if (!snap.exists()) {
        return { ok: false, error: 'Noch kein Cloud-Spielstand vorhanden.' };
      }
      const data = snap.data() as { saveJson?: string; updatedAt?: number };
      if (!data.saveJson) return { ok: false, error: 'Cloud-Spielstand ist leer.' };
      return { ok: true, saveJson: data.saveJson, updatedAt: data.updatedAt ?? 0 };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Download fehlgeschlagen' };
    }
  }

  /** Compare two saves to see if cloud save clearly has more progress (for smart auto-pull on new device) */
  public isCloudSaveAhead(localState: GameState, cloudJson: string): boolean {
    try {
      const c = JSON.parse(cloudJson) as Partial<SaveData>;
      const score = (d: {
        ngPlusLevel?: number;
        omegaCleared?: boolean;
        sector4Cleared?: boolean;
        sector3Cleared?: boolean;
        sector2Cleared?: boolean;
        sector1Cleared?: boolean;
        bossDefeatedCount?: number;
        totalEarned?: number;
        day?: number;
      }) =>
        (d.ngPlusLevel ?? 0) * 100000 +
        (d.omegaCleared ? 50000 : 0) +
        ((d.sector1Cleared ? 1 : 0) + (d.sector2Cleared ? 1 : 0) + (d.sector3Cleared ? 1 : 0) + (d.sector4Cleared ? 1 : 0)) *
          8000 +
        (d.bossDefeatedCount ?? 0) * 1000 +
        (d.totalEarned ?? 0) +
        (d.day ?? 1) * 50;
      return score(c) > score(localState);
    } catch {
      return false;
    }
  }

  public buildLeaderboardEntry(state: GameState, uid: string, captainName: string): LeaderboardEntry {
    const sectorsCleared =
      (state.sector1Cleared ? 1 : 0) +
      (state.sector2Cleared ? 1 : 0) +
      (state.sector3Cleared ? 1 : 0) +
      (state.sector4Cleared ? 1 : 0);
    return {
      uid,
      captainName: captainName.trim().slice(0, 22) || 'Sternen-Kapitän',
      sectorsCleared,
      omegaCleared: state.omegaCleared,
      ngPlusLevel: state.ngPlusLevel,
      day: state.day,
      totalCyclesPlayed: state.records.totalCyclesPlayed,
      fastestSector4Days: state.records.fastestSector4Days,
      fastestOmegaDays: state.records.fastestOmegaDays,
      fastestNgPlusDays: state.records.fastestNgPlusDays,
      bestSectorClearSec: { ...state.records.bestSectorClearSec },
      totalEarned: state.totalEarned,
      totalSold: state.totalSold,
      bossDefeatedCount: state.bossDefeatedCount,
      achievementsCount: state.unlockedAchievements.length,
      suitTheme: state.suitTheme,
      equippedWeapon: state.equippedWeapon,
      shopTier: state.upgrades.shopTier ?? 0,
      lastActivityText: state.records.lastActivityText || `Handelt an Tag ${state.day} in Astro-Barter`,
      updatedAt: Date.now(),
    };
  }

  public async fetchLeaderboard(maxRows = 30): Promise<LeaderboardEntry[]> {
    if (!this.configured || !this.db) return [];
    try {
      const q = query(collection(this.db, 'leaderboard'), orderBy('updatedAt', 'desc'), limit(maxRows));
      const snap = await getDocs(q);
      const list: LeaderboardEntry[] = [];
      snap.forEach((d) => {
        list.push(d.data() as LeaderboardEntry);
      });
      return list;
    } catch {
      return [];
    }
  }

  public async publishActivity(
    captainName: string,
    text: string,
    badge: string,
    accent: string,
  ): Promise<void> {
    if (!this.configured || !this.currentUser || !this.db) return;
    try {
      await addDoc(collection(this.db, 'activities'), {
        uid: this.currentUser.uid,
        captainName: captainName.trim().slice(0, 22) || this.currentUser.displayName,
        text: text.slice(0, 120),
        badge: badge.slice(0, 24),
        accent,
        createdAt: Date.now(),
      });
    } catch {
      // Ignore transient network errors for activity feed
    }
  }

  public async fetchRecentActivities(maxRows = 16): Promise<ActivityFeedEntry[]> {
    if (!this.configured || !this.db) return [];
    try {
      const q = query(collection(this.db, 'activities'), orderBy('createdAt', 'desc'), limit(maxRows));
      const snap = await getDocs(q);
      const list: ActivityFeedEntry[] = [];
      snap.forEach((d) => {
        const raw = d.data() as Omit<ActivityFeedEntry, 'id'>;
        list.push({ id: d.id, ...raw });
      });
      return list;
    } catch {
      return [];
    }
  }

  private friendlyAuthError(err: unknown): string {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/invalid-email') return 'Ungültige E-Mail-Adresse.';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'E-Mail oder Passwort stimmt nicht.';
    }
    if (code === 'auth/email-already-in-use') return 'Diese E-Mail ist bereits registriert — bitte anmelden.';
    if (code === 'auth/weak-password') return 'Passwort muss mindestens 6 Zeichen lang sein.';
    if (code === 'auth/popup-closed-by-user') return 'Anmeldefenster wurde geschlossen.';
    return err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.';
  }
}

export const firebaseService = new FirebaseCloudService();
