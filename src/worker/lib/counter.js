// Adds one to counter `name` for the UTC day of `now`.
export function increment(db, name, now) {
  return db
    .prepare('INSERT INTO counters (name, day, count) VALUES (?, ?, 1) ON CONFLICT (name, day) DO UPDATE SET count = count + 1')
    .bind(name, now.toISOString().slice(0, 10))
    .run();
}
