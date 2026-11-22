CREATE TABLE counters (name TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (name, day));
CREATE TABLE pulse (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL,
  lack INTEGER NOT NULL CHECK (lack BETWEEN 1 AND 3),
  left_out INTEGER NOT NULL CHECK (left_out BETWEEN 1 AND 3),
  isolated INTEGER NOT NULL CHECK (isolated BETWEEN 1 AND 3));
CREATE TABLE experiment (code TEXT PRIMARY KEY, created_at TEXT NOT NULL, actions TEXT NOT NULL,
  pre_connected INTEGER NOT NULL CHECK (pre_connected BETWEEN 1 AND 5),
  pre_mood INTEGER NOT NULL CHECK (pre_mood BETWEEN 1 AND 5),
  pre_stress INTEGER NOT NULL CHECK (pre_stress BETWEEN 1 AND 5),
  finished_at TEXT,
  post_connected INTEGER CHECK (post_connected BETWEEN 1 AND 5),
  post_mood INTEGER CHECK (post_mood BETWEEN 1 AND 5),
  post_stress INTEGER CHECK (post_stress BETWEEN 1 AND 5));
CREATE TABLE answers (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')));
