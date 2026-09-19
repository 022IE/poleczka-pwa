-- Radar anomalii — trwała historia alarmów i reakcji użytkownika.

CREATE TABLE anomaly_alerts (
  alert_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  anomaly_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'radar',
  state TEXT NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'important', 'ignored', 'resolved')),
  first_detected_at TEXT NOT NULL,
  last_detected_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX idx_anomaly_alerts_state
ON anomaly_alerts(state, resolved_at, first_detected_at DESC);

CREATE INDEX idx_anomaly_alerts_fingerprint
ON anomaly_alerts(fingerprint, resolved_at, last_detected_at DESC);

CREATE TABLE anomaly_alert_reactions (
  reaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('important', 'ignore')),
  reacted_at TEXT NOT NULL,
  FOREIGN KEY (alert_id) REFERENCES anomaly_alerts(alert_id) ON DELETE CASCADE
);

CREATE INDEX idx_anomaly_alert_reactions_alert
ON anomaly_alert_reactions(alert_id, reacted_at DESC);
