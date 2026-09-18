-- 0001_receipts_sk.sql
-- Lokalne pole aplikacji Półeczka Iwonki.
-- Nie pochodzi z Loyverse i nie może być nadpisywane przez synchronizację źródłową.

ALTER TABLE receipts
ADD COLUMN sk BOOLEAN NOT NULL DEFAULT TRUE
CHECK (sk IN (0, 1));
