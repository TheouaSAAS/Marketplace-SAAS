/**
 * Journalisation structurée : une ligne JSON par événement, lisible par tout
 * collecteur de logs (Vercel, Datadog, Loki…).
 *
 * Règle de minimisation : les champs sensibles (secrets, contacts, coordonnées
 * géographiques) sont masqués automatiquement, à toute profondeur. Ne jamais
 * journaliser un contenu de message privé ni une position de visiteur.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY =
  /pass(word)?|secret|token|api[_-]?key|authorization|cookie|session|e-?mail|phone|t[ée]l[ée]phone|whatsapp|^lat(itude)?$|^lng$|^lon(gitude)?$|coords?|position|^ip(_?address)?$/i;

export const REDACTED = "[masqué]";

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, ...(process.env.NODE_ENV !== "production" && { stack: value.stack }) };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1)]),
  );
}

function minimumLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL;
  return configured && configured in LEVELS ? (configured as LogLevel) : "info";
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(bindings: Record<string, unknown> = {}): Logger {
  const write = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
    if (LEVELS[level] < LEVELS[minimumLevel()]) return;
    const entry = {
      level,
      time: new Date().toISOString(),
      msg: message,
      ...(redact({ ...bindings, ...context }) as Record<string, unknown>),
    };
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger = createLogger({ app: "carrefour-des-possibles" });
