-- Leon mówi — decyzje użytkownika dla dziennych rekomendacji.

CREATE TABLE leon_recommendation_decisions (
  for_date TEXT NOT NULL,
  recommendation_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('do', 'defer', 'reject')),
  first_decided_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (for_date, recommendation_id),
  FOREIGN KEY (for_date, recommendation_id)
    REFERENCES leon_daily_recommendations(for_date, recommendation_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_leon_recommendation_decisions_decision
ON leon_recommendation_decisions(decision, for_date DESC);
