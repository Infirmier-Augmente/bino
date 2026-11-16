/** Erreur métier avec code HTTP et code stable (lisible côté mobile). */
export class AppError extends Error {
  constructor(
    readonly status: 400 | 401 | 404 | 409 | 422 | 500 | 503,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what: string, id: string) =>
  new AppError(404, 'not-found', `${what} introuvable (${id}).`);
