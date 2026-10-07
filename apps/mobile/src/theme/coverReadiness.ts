type PendingCover = {
  id: number;
  resolve: (id: number) => void;
  timeout: ReturnType<typeof setTimeout>;
};

/** Match a cover image's load callback to the transition that created it. */
export class CoverReadiness {
  private sequence = 0;
  private pending: PendingCover | null = null;

  begin(timeoutMs: number): { id: number; ready: Promise<number> } {
    const id = ++this.sequence;
    let resolve!: (resolvedId: number) => void;
    const ready = new Promise<number>((done) => { resolve = done; });
    const timeout = setTimeout(() => this.complete(id), timeoutMs);
    this.pending = { id, resolve, timeout };
    return { id, ready };
  }

  complete(id: number): void {
    const pending = this.pending;
    if (!pending || pending.id !== id) return;
    clearTimeout(pending.timeout);
    this.pending = null;
    pending.resolve(id);
  }
}
