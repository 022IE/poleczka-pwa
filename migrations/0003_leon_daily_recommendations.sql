-- Daily Leon — dzienne snapshoty rekomendacji i historia.
-- Jeden dzień ma maksymalnie trzy pozycje; klucz (for_date, position) zapewnia idempotencję.

CREATE TABLE leon_daily_recommendations (
  for_date TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 3),
  recommendation_id TEXT NOT NULL,
  tone TEXT NOT NULL CHECK (tone IN ('positive', 'warning', 'neutral')),
  badge TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  reason TEXT NOT NULL,
  action TEXT NOT NULL,
  priority INTEGER NOT NULL,
  generated_at TEXT NOT NULL,
  current_start TEXT NOT NULL,
  current_end TEXT NOT NULL,
  previous_start TEXT NOT NULL,
  previous_end TEXT NOT NULL,
  PRIMARY KEY (for_date, position),
  UNIQUE (for_date, recommendation_id)
);

CREATE INDEX idx_leon_daily_recommendations_date
ON leon_daily_recommendations(for_date DESC, position);
