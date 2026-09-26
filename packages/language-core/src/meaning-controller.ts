export interface MeaningRequest {
  sessionId: string;
  passageId: string;
  revisionKey: string;
  text: string;
  learningLanguage: string;
  meaningLanguage: string;
}

export interface MeaningResult {
  text: string;
}

export interface MeaningState {
  text: string;
  isLoading: boolean;
  error: Error | null;
  renderedRevision: string | null;
}

export interface MeaningControllerOptions {
  completeDelayMs?: number;
  incompleteDelayMs?: number;
  minimumSpacingMs?: number;
  translate: (request: MeaningRequest, signal: AbortSignal) => Promise<MeaningResult>;
  onChange?: (state: MeaningState) => void;
}

const sentenceComplete = (value: string): boolean =>
  /[.!?…。！？]["'”’»)]?$/.test(value.trim());

const sameContext = (left: MeaningRequest, right: MeaningRequest): boolean =>
  left.sessionId === right.sessionId
  && left.passageId === right.passageId
  && left.learningLanguage === right.learningLanguage
  && left.meaningLanguage === right.meaningLanguage;

/**
 * Revision-owned latest-meaning controller for Subtitles/Voice helper text.
 *
 * A timer follows the newest transcript revision, while an admitted request is
 * allowed to finish when the transcript only grows inside the same passage.
 * Results render only if their revision is still current. Changing passage,
 * language, or session aborts the old request immediately.
 */
export class MeaningController {
  #desired: MeaningRequest | null = null;
  #inFlight: MeaningRequest | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #abort: AbortController | null = null;
  #generation = 0;
  #lastDispatchAt = 0;
  #finalRequested = false;
  #state: MeaningState = { text: '', isLoading: false, error: null, renderedRevision: null };

  readonly #completeDelayMs: number;
  readonly #incompleteDelayMs: number;
  readonly #minimumSpacingMs: number;
  readonly #translate: MeaningControllerOptions['translate'];
  readonly #onChange?: MeaningControllerOptions['onChange'];

  constructor(options: MeaningControllerOptions) {
    this.#completeDelayMs = Math.max(0, options.completeDelayMs ?? 450);
    this.#incompleteDelayMs = Math.max(this.#completeDelayMs, options.incompleteDelayMs ?? 1_800);
    this.#minimumSpacingMs = Math.max(0, options.minimumSpacingMs ?? 2_500);
    this.#translate = options.translate;
    this.#onChange = options.onChange;
  }

  get state(): MeaningState {
    return { ...this.#state };
  }

  update(request: MeaningRequest, options: { final?: boolean; cached?: string } = {}): void {
    const previous = this.#desired;
    const contextChanged = previous !== null && !sameContext(previous, request);
    if (contextChanged) this.#cancelInFlight();
    this.#desired = { ...request };
    this.#finalRequested = Boolean(options.final);
    this.#state.error = null;

    if (options.cached?.trim()) {
      this.#clearTimer();
      this.#cancelInFlight();
      this.#state = {
        text: options.cached.trim(),
        isLoading: false,
        error: null,
        renderedRevision: request.revisionKey,
      };
      this.#emit();
      return;
    }

    if (this.#state.renderedRevision !== request.revisionKey) {
      this.#state.renderedRevision = null;
      if (contextChanged || !previous || !request.text.startsWith(previous.text)) this.#state.text = '';
    }
    this.#schedule();
    this.#emit();
  }

  retry(): void {
    if (!this.#desired) return;
    this.#state.error = null;
    this.#finalRequested = true;
    this.#schedule(0);
    this.#emit();
  }

  reset(): void {
    this.#generation += 1;
    this.#clearTimer();
    this.#cancelInFlight(false);
    this.#desired = null;
    this.#finalRequested = false;
    this.#state = { text: '', isLoading: false, error: null, renderedRevision: null };
    this.#emit();
  }

  #schedule(forcedDelay?: number): void {
    if (!this.#desired) return;
    if (this.#inFlight && sameContext(this.#inFlight, this.#desired)) return;
    this.#clearTimer();
    const quietDelay = forcedDelay ?? (this.#finalRequested ? 0 : sentenceComplete(this.#desired.text) ? this.#completeDelayMs : this.#incompleteDelayMs);
    const spacingDelay = Math.max(0, this.#lastDispatchAt + this.#minimumSpacingMs - Date.now());
    const delay = Math.max(quietDelay, spacingDelay);
    const generation = this.#generation;
    this.#state.isLoading = true;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#dispatch(generation);
    }, delay);
  }

  async #dispatch(generation: number): Promise<void> {
    const request = this.#desired;
    if (!request || generation !== this.#generation) return;
    const controller = new AbortController();
    this.#abort = controller;
    this.#inFlight = { ...request };
    this.#lastDispatchAt = Date.now();
    this.#state.isLoading = true;
    this.#emit();
    try {
      const result = await this.#translate(request, controller.signal);
      if (controller.signal.aborted || generation !== this.#generation) return;
      const desired = this.#desired;
      if (result.text.trim() && desired?.revisionKey === request.revisionKey && sameContext(desired, request)) {
        this.#state.text = result.text.trim();
        this.#state.renderedRevision = request.revisionKey;
        this.#state.error = null;
      }
    } catch (error) {
      if (!controller.signal.aborted && generation === this.#generation) {
        this.#state.error = error instanceof Error ? error : new Error('Meaning request failed');
      }
    } finally {
      if (this.#abort === controller) this.#abort = null;
      if (this.#inFlight?.revisionKey === request.revisionKey) this.#inFlight = null;
      if (generation === this.#generation) {
        const desired = this.#desired;
        this.#state.isLoading = false;
        if (desired && desired.revisionKey !== request.revisionKey) this.#schedule();
        this.#emit();
      }
    }
  }

  #clearTimer(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #cancelInFlight(incrementGeneration = true): void {
    if (incrementGeneration) this.#generation += 1;
    this.#abort?.abort();
    this.#abort = null;
    this.#inFlight = null;
    this.#state.isLoading = false;
  }

  #emit(): void {
    this.#onChange?.(this.state);
  }
}
