# PÓŁECZKA IWONKI — D1 STAN AKTUALNY

**Status:** dokument techniczny obowiązującego środowiska D1  
**Aktualizacja:** 18.09.2026  
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
5. `deliveries`
6. `receipt_payments`
7. `webhook_events`

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
  delivery_number INTEGER REFERENCES deliveries(delivery_number),
  FOREIGN KEY(receipt_number) REFERENCES receipts(receipt_number)
);
```

Indeksy:

```sql
CREATE INDEX idx_lines_receipt ON receipt_lines(receipt_number);
CREATE INDEX idx_lines_sku ON receipt_lines(sku);
CREATE INDEX idx_lines_note ON receipt_lines(line_note);
CREATE INDEX idx_lines_delivery ON receipt_lines(delivery_number);
```

Powiązanie:

`receipt_lines.receipt_number -> receipts.receipt_number`

`line_note` pozostaje surową wartością źródłową z Loyverse / importu i nie jest usuwane.
Kanonicznym powiązaniem aplikacji z dostawą jest `receipt_lines.delivery_number`, wskazujące na `deliveries.delivery_number`.

Reguła synchronizacji:
- dokładna wartość `line_note`, dla której istnieje dostawa, ustawia ten sam `delivery_number`,
- puste albo nierozpoznane `line_note` ustawia `delivery_number = -1`,
- `line_note = 0` ustawia `delivery_number = 0`,
- dodanie wcześniej brakującej dostawy automatycznie przepina pasujące pozycje z surowym `line_note`.

Triggery D1 utrzymujące zgodność:
- `trg_receipt_lines_delivery_insert`,
- `trg_receipt_lines_delivery_note_update`,
- `trg_deliveries_resolve_lines`.

---

## 9.1. `deliveries`

Tabela dostaw została wdrożona 18.09.2026.

Aktualny schemat:

```sql
CREATE TABLE deliveries (
  delivery_number INTEGER PRIMARY KEY,
  delivery_date TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_cost REAL NOT NULL CHECK (total_cost >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Pola są nazwane po angielsku zgodnie ze standardem D1 projektu.

Dane startowe zaimportowane z arkusza:

| delivery_number | delivery_date | supplier_name | quantity | total_cost |
|---:|:---:|---|---:|---:|
| -1 | 2026-09-05 | Dostawa niezidentyfikowana | 100 | 1200.00 |
| 0 | 2026-09-05 | Dostawa wewnętrzna | 100 | 1200.00 |
| 1 | 2026-09-05 | MAT Fortuna Targowisko | 160 | 2300.00 |
| 2 | 2026-09-05 | Talia Brzesko | 220 | 1750.00 |
| 3 | 2026-09-05 | StockHurt Skawina | 80 | 1200.00 |
| 4 | 2026-09-16 | Aneta | 10 | 100.00 |
| 5 | 2026-06-16 | Talia Brzesko | 149 | 975.00 |
| 6 | 2026-09-16 | MAT Fortuna Targowisko | 90 | 1280.00 |
| 7 | 2026-09-18 | Karolina | 10 | 100.00 |

Znaczenie rekordów specjalnych:
- `-1` — dostawa niezidentyfikowana,
- `0` — dostawa wewnętrzna.

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

## 13. Import historyczny 05.09.2026 — wykonany

Import sprzedaży z pliku `paragony 050926.ods` został wykonany do `poleczka-dev` 17.09.2026 i stanowi wzorzec dla kolejnych paczek historycznych.

Wynik końcowy:

- 19 paragonów,
- 48 pozycji,
- 19 płatności,
- suma paragonów = suma pozycji = suma płatności = `2441,00 PLN`,
- 48/48 pozycji z poprawnym `item_id`,
- 48/48 pozycji z SKU,
- `Parasol` ma ręcznie potwierdzony SKU `10001`,
- brak różnic sum pozycji względem paragonów,
- brak różnic sum płatności względem paragonów,
- brak błędów `PRAGMA foreign_key_check`.

Wcześniej przygotowany roboczy skrypt `01_receipt_payments_migration.sql`, który tworzył drugi model tabeli płatności (`payment_id`, `payment_type`, `amount`, `currency`), jest nieaktualny i **nie wolno go wykonywać** na `poleczka-dev`.

Obowiązuje istniejąca tabela `receipt_payments` z polami:

- `payment_key`,
- `receipt_number`,
- `payment_type_id`,
- `name`,
- `type`,
- `money_amount`,
- `paid_at`.

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

---

## 16. Wzorzec kolejnych importów historycznych sprzedaży

Kolejne paczki historycznych paragonów importujemy według procedury sprawdzonej na paczce 05.09.2026.

### 16.1 Źródło i audyt przed zapisem

Najpierw czytamy oryginalny plik źródłowy i wykonujemy audyt bez zapisu do D1:

- liczba wierszy sprzedaży,
- liczba unikalnych paragonów,
- zakres numerów paragonów,
- data / daty sprzedaży,
- suma wartości,
- kompletność nazw artykułów,
- kompletność numerów dostaw,
- kompletność form płatności,
- kontrola cen i ilości,
- kontrola, czy jeden paragon nie ma sprzecznych form płatności.

Nie korzystamy automatycznie ze starych roboczych SQL, jeśli nie zostały ponownie sprawdzone względem bieżącego schematu `poleczka-dev`.

### 16.2 Preflight na żywej `poleczka-dev`

Przed importem obowiązkowo sprawdzamy:

- `PRAGMA foreign_key_check`,
- kolizje `receipt_number`,
- kolizje planowanych `line_id`,
- kolizje planowanych `payment_key`,
- istniejące rekordy z importowanej daty,
- jednoznaczność mapowania nazw artykułów do aktywnych `items`,
- mapowanie form płatności,
- dostępność i jednoznaczność SKU po `item_id`.

Jeżeli istnieje kolizja lub niejednoznaczność, import zatrzymujemy do wyjaśnienia zamiast zgadywać.

### 16.3 Artykuł i `item_id`

Najpierw wykonujemy `trim()` nazwy źródłowej. Następnie stosujemy tylko jawnie uzgodnione mapowania nazw.

Mapowania ustalone przy imporcie 05.09.2026, które należy ponownie stosować, jeżeli te same nazwy wystąpią w kolejnych paczkach:

- `Bluzki` -> `Bluzka`,
- `Buty` -> `Sneakersy`,
- `Spodenki` -> `Shorty`,
- `Sweterek` -> `Sweter`,
- `Torba` -> `Torebka`.

`item_id` przypisujemy wyłącznie przy dokładnie jednym aktywnym dopasowaniu `lower(trim(items.item_name))` do nazwy kanonicznej.

Nie stosujemy fuzzy matching ani automatycznego zgadywania podobnych nazw.

### 16.4 SKU

SKU uzupełniamy na podstawie wcześniejszych `receipt_lines` dla tego samego `item_id`.

Zasada:

- jeżeli dla `item_id` istnieje dokładnie jeden różny niepusty SKU -> używamy go,
- jeżeli nie ma SKU -> pozostawiamy `NULL` i zgłaszamy nazwę użytkownikowi,
- jeżeli istnieje więcej niż jeden SKU -> zatrzymujemy automatyczne przypisanie i zgłaszamy konflikt,
- ręcznie potwierdzone SKU może zostać zapisane jako jawny wyjątek.

Potwierdzony wyjątek:

- `Parasol` -> SKU `10001`.

### 16.5 Wartości domyślne ustalone dla paczek historycznych

Jeżeli dana paczka ma taki sam charakter jak import 05.09.2026 i źródło nie dostarcza innych wartości, stosujemy:

- `quantity = 1.0` dla każdego wiersza źródłowego,
- `total_discount = 0` na paragonie,
- `total_discount = 0` na pozycji,
- `cost = 0`,
- `cost_total = 0`,
- `price = gross_total_money = total_money` dla pozycji,
- `receipt_type = SALE`,
- brakujące techniczne dane, których źródło nie zawiera, pozostają `NULL` zamiast być wymyślane.

`total_tax`, `tip`, `surcharge`, `created_at`, `updated_at` i `paid_at` pozostają `NULL`, o ile konkretne źródło lub użytkownik nie poda wiarygodnych wartości.

### 16.6 Godzina paragonu

Jeżeli źródło zawiera tylko datę bez godziny:

- dla każdego paragonu losujemy jedną stałą godzinę w przedziale `13:00–18:00` czasu polskiego,
- wszystkie pozycje i płatność odnoszą się do tego samego paragonu,
- losowanie jest utrwalane w przygotowanym imporcie — ponowne wykonanie nie może wylosować innej godziny,
- do `receipt_date` zapisujemy czas UTC w formacie zakończonym `Z`, z poprawnym przeliczeniem czasu lokalnego dla danej daty,
- nie kopiujemy syntetycznej godziny do `created_at`, `updated_at` ani `paid_at`.

### 16.7 Dostawa

Numer dostawy z pliku źródłowego nadal trafia do surowego pola `receipt_lines.line_note`.
D1 następnie utrzymuje kanoniczne `receipt_lines.delivery_number`.

Obowiązują reguły projektu:

- `line_note = 0` -> `delivery_number = 0` = dostawa wewnętrzna,
- puste pole -> `delivery_number = -1` = niezidentyfikowana,
- numer, którego nie ma jeszcze w `deliveries`, tymczasowo daje `delivery_number = -1`,
- po dodaniu brakującej dostawy pasujące pozycje są automatycznie przepinane na właściwy `delivery_number`,
- surowej wartości `line_note` nie wolno bezpowrotnie utracić.

### 16.8 Płatności

Płatność zapisujemy do istniejącej tabeli `receipt_payments`.

Potwierdzone mapowania:

- `Gotówka` -> `CASH` -> `c0495d7c-d00c-4297-867a-f46dff06226d`,
- `Karta` -> `NONINTEGRATEDCARD` -> `42d173f3-2817-4e91-9a77-2aeac5f9a710`.

Przed każdym kolejnym importem mapowanie należy kontrolnie sprawdzić w żywej bazie, ale nie tworzymy nowego typu płatności, jeżeli obecne ID pozostają aktualne.

### 16.9 Rekordy techniczne i idempotencja

Import powinien używać deterministycznych, unikalnych identyfikatorów technicznych dla:

- `receipt_lines.line_id`,
- `receipt_payments.payment_key`.

Import musi być zaprojektowany tak, aby przypadkowe ponowne uruchomienie nie tworzyło duplikatów.

Historyczny import ręczny nie tworzy `webhook_events`.

### 16.10 Kolejność zapisu i rollbacku

Kolejność zapisu:

1. `receipts`,
2. `receipt_lines`,
3. `receipt_payments`.

Kolejność rollbacku:

1. `receipt_payments`,
2. `receipt_lines`,
3. `receipts`.

Rollback ma usuwać wyłącznie rekordy należące do konkretnej paczki importowej.

### 16.11 Weryfikacja po imporcie

Po każdym imporcie obowiązkowo potwierdzamy:

- oczekiwaną liczbę paragonów,
- oczekiwaną liczbę pozycji,
- oczekiwaną liczbę płatności,
- `SUM(receipts.total_money) = SUM(receipt_lines.total_money) = SUM(receipt_payments.money_amount)`,
- zgodność sum osobno dla każdego paragonu,
- brak `item_id` tam, gdzie oczekiwano pełnego mapowania,
- kompletność SKU lub listę świadomych wyjątków,
- zgodność `item_name` z powiązanym `items.item_name`,
- poprawność numerów dostaw,
- poprawność form płatności,
- zakres syntetycznych godzin, jeżeli były używane,
- brak osieroconych `receipt_lines`,
- brak osieroconych `receipt_payments`,
- `PRAGMA foreign_key_check` = 0 błędów.

Dopiero po przejściu pełnej weryfikacji paczkę uznajemy za zaimportowaną poprawnie.

### 16.12 Workflow jednorazowy

Jeżeli import wykonujemy przez GitHub Actions, workflow może mieć automatyczny trigger tylko na czas kontrolowanego pierwszego uruchomienia. Po sukcesie należy pozostawić go jako `workflow_dispatch` / ręczny, żeby paczka nie została przypadkowo wykonana ponownie.
