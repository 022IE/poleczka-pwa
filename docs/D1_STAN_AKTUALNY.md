# PÓŁECZKA IWONKI — D1 STAN AKTUALNY

**Status:** dokument techniczny obowiązującego środowiska D1  
**Aktualizacja:** 17.09.2026  
**Gałąź robocza:** `dev`

---

## 1. Baza autorytatywna

Od 17.09.2026 główną i aktywną bazą danych PWA jest:

- nazwa: `poleczka-dev`
- D1 database ID: `099b4d9e-ad73-441b-a2be-a00f347a5905`

Ta baza jest od tej chwili źródłem prawdy dla danych operacyjnych aplikacji Półeczka Iwonki.

Wszystkie kolejne:
- migracje,
- importy historyczne,
- importy ręczne,
- rozwój modułów PWA,
- zapytania Workera,
- integracje Loyverse,
- przyszłe integracje Vinted,

mają być wykonywane względem `poleczka-dev`, chyba że konkretne zadanie wyraźnie wskazuje środowisko testowe lub archiwalne.

---

## 2. Poprzednia baza

Poprzednia baza:

- nazwa: `poleczka-loyverse`
- D1 database ID: `4ababa0a-8912-49b0-9ee9-16ce771c27f3`

pozostaje zachowana jako baza archiwalna / kopia bezpieczeństwa po migracji.

Nie jest już docelowym miejscem zapisu live webhooka Loyverse.

Nie należy wykonywać w niej nowych migracji aplikacyjnych ani traktować jej jako bieżącej bazy PWA.

---

## 3. Live webhook Loyverse

Worker:

`poleczka-loyverse-webhook`

ma aktywny binding:

`DB -> poleczka-dev`

Zweryfikowany database ID bindingu:

`099b4d9e-ad73-441b-a2be-a00f347a5905`

Obowiązujący przepływ danych:

`Loyverse -> webhook -> poleczka-loyverse-webhook -> poleczka-dev -> PWA`

---

## 4. Wynik finalnego cutoveru

Finalny cutover zakończył się sukcesem 17.09.2026.

Wykonano:
- synchronizację danych ze starej bazy do `poleczka-dev`,
- przełączenie bindingu Workera,
- końcową synchronizację po przełączeniu,
- porównanie danych tabel źródło/cel,
- kontrolę kluczy obcych.

Weryfikacja końcowa potwierdziła:
- zgodność danych źródło/cel 1:1 w objętych migracją tabelach,
- brak błędów `PRAGMA foreign_key_check`,
- aktywny Worker korzystający z `poleczka-dev`,
- rozmiar obu baz po finalnej synchronizacji: `196608 B`.

Sam rozmiar pliku nie jest traktowany jako dowód zgodności; zgodność została potwierdzona również przez porównanie rekordów / digestów tabel w procedurze cutoveru.

---

## 5. Aktualne tabele użytkowe

Aktualnie potwierdzone tabele użytkowe w D1:

1. `categories`
2. `items`
3. `receipts`
4. `receipt_lines`
5. `receipt_payments`
6. `webhook_events`

Tabela `_cf_KV` jest tabelą techniczną Cloudflare i nie jest traktowana jako część modelu biznesowego PWA.

---

## 6. `categories`

Aktualny schemat:

```sql
CREATE TABLE categories (
  category_id TEXT PRIMARY KEY,
  name TEXT,
  deleted_at TEXT,
  synced_at TEXT NOT NULL
);
```

---

## 7. `items`

Aktualny schemat:

```sql
CREATE TABLE items (
  item_id TEXT PRIMARY KEY,
  item_name TEXT,
  category_id TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  synced_at TEXT NOT NULL
);
```

Indeks:

```sql
CREATE INDEX idx_items_category_id ON items(category_id);
```

`category_id` jest logicznym powiązaniem artykułu z kategorią. W aktualnym schemacie nie ma zadeklarowanego klucza obcego dla tego pola.

---

## 8. `receipts`

Aktualny schemat:

```sql
CREATE TABLE receipts (
  receipt_number TEXT PRIMARY KEY,
  receipt_type TEXT,
  refund_for TEXT,
  source TEXT,
  receipt_date TEXT,
  created_at TEXT,
  updated_at TEXT,
  cancelled_at TEXT,
  store_id TEXT,
  pos_device_id TEXT,
  total_money REAL,
  total_discount REAL,
  total_tax REAL,
  tip REAL,
  surcharge REAL,
  synced_at TEXT NOT NULL
);
```

Indeksy:

```sql
CREATE INDEX idx_receipts_date ON receipts(receipt_date);
CREATE INDEX idx_receipts_updated ON receipts(updated_at);
```

---

## 9. `receipt_lines`

Aktualny schemat:

```sql
CREATE TABLE receipt_lines (
  line_id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL,
  item_id TEXT,
  variant_id TEXT,
  item_name TEXT,
  variant_name TEXT,
  sku TEXT,
  quantity REAL,
  price REAL,
  gross_total_money REAL,
  total_money REAL,
  cost REAL,
  cost_total REAL,
  total_discount REAL,
  line_note TEXT,
  FOREIGN KEY(receipt_number) REFERENCES receipts(receipt_number)
);
```

Indeksy:

```sql
CREATE INDEX idx_lines_receipt ON receipt_lines(receipt_number);
CREATE INDEX idx_lines_sku ON receipt_lines(sku);
CREATE INDEX idx_lines_note ON receipt_lines(line_note);
```

Powiązanie:

`receipt_lines.receipt_number -> receipts.receipt_number`

Pole `line_note` jest źródłem numeru Lp. dostawy zgodnie z regułami projektu.

---

## 10. `receipt_payments`

Tabela form płatności **już istnieje w aktywnej D1**.

Aktualny schemat:

```sql
CREATE TABLE receipt_payments (
  payment_key TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL,
  payment_type_id TEXT,
  name TEXT,
  type TEXT,
  money_amount REAL,
  paid_at TEXT,
  FOREIGN KEY(receipt_number) REFERENCES receipts(receipt_number)
);
```

Indeks:

```sql
CREATE INDEX idx_payments_receipt ON receipt_payments(receipt_number);
```

Powiązanie:

`receipt_payments.receipt_number -> receipts.receipt_number`

Forma płatności dla interfejsu i analiz powinna być odczytywana z tej tabeli, a nie dopisywana do `receipts` bez osobnej decyzji o zmianie modelu.

---

## 11. `webhook_events`

Aktualny schemat:

```sql
CREATE TABLE webhook_events (
  event_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  merchant_id TEXT,
  event_created_at TEXT,
  receipt_numbers_json TEXT NOT NULL,
  next_index INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  processed_at TEXT,
  last_error TEXT
);
```

Indeksy:

```sql
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed_at ON webhook_events(processed_at);
CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at);
CREATE INDEX idx_webhook_pending ON webhook_events(processed_at, attempts, received_at);
```

---

## 12. Relacje kluczowe

Obowiązujące relacje bazodanowe:

```text
receipts
  ├── receipt_lines
  │     receipt_lines.receipt_number
  │       -> receipts.receipt_number
  │
  └── receipt_payments
        receipt_payments.receipt_number
          -> receipts.receipt_number
```

Usuwanie lub importowanie danych sprzedażowych musi zachowywać te relacje.

---

## 13. Ważna korekta dotycząca importu 05.09.2026

Wcześniej przygotowany roboczy skrypt `01_receipt_payments_migration.sql`, który tworzył nową tabelę `receipt_payments` o kolumnach m.in. `payment_id`, `payment_type`, `amount`, `currency`, **nie odpowiada rzeczywistemu schematowi aktywnej D1**.

Tego skryptu **nie należy wykonywać** na `poleczka-dev`.

Aktywna tabela `receipt_payments` już istnieje i używa kolumn:

- `payment_key`,
- `receipt_number`,
- `payment_type_id`,
- `name`,
- `type`,
- `money_amount`,
- `paid_at`.

Przed importem paragonów z 05.09.2026 skrypty importowe muszą zostać dostosowane do tego rzeczywistego schematu.

Nie wolno tworzyć drugiego modelu płatności równolegle do istniejącego.

---

## 14. Zasada dla kolejnych zmian D1

Przed każdą zmianą struktury:

1. sprawdzamy aktualny schemat `poleczka-dev`,
2. przygotowujemy wersjonowaną migrację w `migrations/`,
3. nie modyfikujemy wdrożonej migracji historycznej,
4. testujemy migrację na właściwym środowisku developerskim,
5. po wdrożeniu wykonujemy kontrolę relacji i podstawowych danych.

Wszelkie dokumenty projektowe opisujące „aktualny model D1” powinny być zgodne z tym plikiem i z rzeczywistym schematem `poleczka-dev`.

---

## 15. Status starej bazy

`poleczka-loyverse` pozostaje czasowo jako archiwum po cutoverze.

Nie należy jej usuwać bez osobnej decyzji użytkownika i wcześniejszej kontroli, że nie jest potrzebna do rollbacku, audytu lub odzyskania danych.
