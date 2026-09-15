// log.js — one line per request, one place that decides the format.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.DEMO_LOG_LEVEL || "info"] ?? LEVELS.info;

function emit(level, msg, fields) {
  if (LEVELS[level] < threshold) return;
  const row = { t: new Date().toISOString(), level, msg, ...fields };
  process.stdout.write(JSON.stringify(row) + "\n");
}

export const debug = (msg, fields = {}) => emit("debug", msg, fields);
export const info = (msg, fields = {}) => emit("info", msg, fields);
export const warn = (msg, fields = {}) => emit("warn", msg, fields);
export const error = (msg, fields = {}) => emit("error", msg, fields);
