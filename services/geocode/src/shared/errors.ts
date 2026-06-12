/** Lançado quando o índice SQLite não está disponível (arquivo ausente/corrompido). */
export class DbUnavailableError extends Error {
  /** @param message mensagem exibida na resposta 503. */
  constructor(message = "Índice de geocodificação indisponível") {
    super(message);
    this.name = "DbUnavailableError";
  }
}
