import Database          from "better-sqlite3";
import type { Database as Db } from "better-sqlite3";

/** Opções de abertura da conexão SQLite. */
export interface OpenOptions {
  /** Abre somente para leitura; o arquivo precisa existir. */
  readonly?: boolean;
}

/**
 * Factory de conexão SQLite. Não há singleton aqui — o ciclo de vida é
 * controlado pelo container (DIP), que abre o banco uma única vez.
 */
export function openDb(path: string, options: OpenOptions = {}): Db {
  const readonly = options.readonly ?? false;
  const db = new Database(path, { readonly, fileMustExist: readonly });

  if (!readonly) {
    // WAL acelera escritas em massa da ingestão; inválido em conexão read-only.
    db.pragma("journal_mode = WAL");
  }

  return db;
}
