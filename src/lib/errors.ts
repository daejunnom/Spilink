export class AppError extends Error {
  readonly code: string;
  readonly params: Record<string, string | number>;
  constructor(code: string, params: Record<string, string | number> = {}) {
    super(code); this.name = 'AppError'; this.code = code; this.params = params;
  }
}
