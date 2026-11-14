import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { HospitalState } from '@infirmier/domain';

/**
 * STORE — l'état complet de l'hôpital simulé, en mémoire, validé par zod,
 * sauvegardé en JSON (écriture atomique, différée).
 *
 * Pourquoi pas une base SQL ? En hackathon le modèle change toutes les heures :
 * un schéma zod + un fichier JSON = zéro migration à gérer à 7 développeurs.
 * Les services passent par cette classe : la remplacer par Postgres (HDS) plus tard
 * ne touche pas les routes.
 */
export class HospitalStore {
  private state: HospitalState;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> = Promise.resolve();

  private constructor(
    initial: HospitalState,
    private readonly file: string | null,
  ) {
    this.state = initial;
  }

  /** Store en mémoire seule (tests). */
  static inMemory(initial: HospitalState): HospitalStore {
    return new HospitalStore(HospitalState.parse(initial), null);
  }

  /**
   * Ouvre le fichier d'état s'il existe et est valide ; sinon part de `fallback()`.
   * Un fichier invalide (schéma changé) est mis de côté, jamais écrasé en silence.
   */
  static async open(
    file: string | null,
    fallback: () => HospitalState,
    logger: Pick<Console, 'warn' | 'info'> = console,
  ): Promise<{ store: HospitalStore; fresh: boolean }> {
    if (!file) return { store: HospitalStore.inMemory(fallback()), fresh: true };
    try {
      const raw = await readFile(file, 'utf8');
      const parsed = HospitalState.safeParse(JSON.parse(raw));
      if (parsed.success) return { store: new HospitalStore(parsed.data, file), fresh: false };
      const backup = `${file}.invalide-${Date.now()}.json`;
      await rename(file, backup);
      logger.warn(`[store] état incompatible avec le schéma actuel → mis de côté dans ${backup}`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn(`[store] lecture impossible (${(e as Error).message}) → état par défaut`);
      }
    }
    const store = new HospitalStore(HospitalState.parse(fallback()), file);
    store.schedulePersist();
    return { store, fresh: true };
  }

  get snapshot(): Readonly<HospitalState> {
    return this.state;
  }

  /** Applique une mutation. La mutation travaille sur une copie : en cas d'erreur, rien ne change. */
  update<T>(mutate: (draft: HospitalState) => T): T {
    const draft = structuredClone(this.state);
    const result = mutate(draft);
    this.state = draft;
    this.schedulePersist();
    return result;
  }

  replace(next: HospitalState): void {
    this.state = HospitalState.parse(next);
    this.schedulePersist();
  }

  private schedulePersist(): void {
    if (!this.file) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, 150);
  }

  /** Écrit immédiatement (appelé aussi à l'arrêt du serveur). */
  async flush(): Promise<void> {
    if (!this.file) return;
    const file = this.file;
    const json = JSON.stringify(this.state, null, 2);
    this.writing = this.writing.then(async () => {
      await mkdir(dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      await writeFile(tmp, json, 'utf8');
      await rename(tmp, file);
    });
    await this.writing;
  }
}
