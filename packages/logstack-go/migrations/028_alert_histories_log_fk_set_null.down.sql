ALTER TABLE alert_histories DROP CONSTRAINT IF EXISTS fk_alert_histories_log;
ALTER TABLE alert_histories
  ADD CONSTRAINT fk_alert_histories_log
  FOREIGN KEY (log_id) REFERENCES logs(id);
