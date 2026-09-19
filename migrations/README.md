# Migracje D1

W tym katalogu będą wersjonowane migracje schematu Cloudflare D1.

Zasady:
- istniejących migracji nie edytujemy po wdrożeniu,
- każda zmiana schematu dostaje nowy numer,
- migracje najpierw testujemy na bazie developerskiej,
- produkcyjna baza nie jest modyfikowana bez wcześniejszej weryfikacji.

## Migracja DOSTAWY — 18.09.2026

Zmiana dodająca tabelę `deliveries`, kolumnę `receipt_lines.delivery_number`, indeks oraz triggery synchronizujące została wykonana bezpośrednio na aktywnej bazie `poleczka-dev` przez idempotentny skrypt:

`scripts/migrate-deliveries-2026-09-18.mjs`

Nie pozostawiamy tej wykonanej zmiany jako oczekującego pliku SQL Wranglera, ponieważ baza została już zmigrowana poza dziennikiem `wrangler d1 migrations`. Dzięki temu przyszłe uruchomienie mechanizmu migracji Wranglera nie spróbuje ponownie wykonać `ALTER TABLE ... ADD COLUMN delivery_number`.

Zasada na przyszłość: jedna zmiana schematu ma być prowadzona od początku do końca jednym mechanizmem migracji; nie mieszamy wykonania skryptowego z nieoznaczoną jako wykonaną migracją Wranglera.


## Migracja S.K. paragonu — 18.09.2026

Migracja `0001_receipts_sk.sql` została zastosowana do aktywnej bazy `poleczka-dev` przez mechanizm `wrangler d1 migrations`.

Zmiana:

```sql
ALTER TABLE receipts
ADD COLUMN sk BOOLEAN NOT NULL DEFAULT TRUE
CHECK (sk IN (0, 1));
```

Weryfikacja po migracji:
- kolumna `receipts.sk` istnieje jako `BOOLEAN`,
- wartość domyślna to `TRUE`,
- wszystkie 121 istniejących w momencie migracji paragonów otrzymało `sk = 1`,
- nowe rekordy, które nie podają `sk`, otrzymują `TRUE` automatycznie.

`sk` jest polem lokalnym PWA i nie pochodzi z Loyverse.


## Migracja „Leon mówi” — 19.09.2026

Migracja `0002_leon_messages.sql` dodaje:
- tabelę `leon_messages` z pulą **100 luźnych tekstów dnia**,
- tabelę `leon_message_history`, która zapisuje tekst wybrany dla konkretnej daty,
- indeks historii po `message_id`.

Tekst dnia jest trwały dla całego dnia i mechanizm rotacji nie dopuszcza ponownego użycia żadnego z 99 poprzednich tekstów. Przy 100 aktywnych tekstach oznacza to pełny cykl bez powtórki przez 100 dni.


## Migracja Daily Leon — 19.09.2026

Migracja `0003_leon_daily_recommendations.sql` dodaje tabelę `leon_daily_recommendations`.

Tabela przechowuje dzienny snapshot maksymalnie trzech rekomendacji Leona wraz z:
- pełną treścią rekomendacji,
- priorytetem i tonem,
- zakresem danych użytym do analizy,
- datą i czasem wygenerowania.

Klucz `(for_date, position)` oraz unikalność `(for_date, recommendation_id)` zapewniają idempotentny zapis jednego spójnego zestawu na dzień.

Historia nie jest czyszczona przy generowaniu kolejnego dnia i stanowi źródło dla widoku historii w module ANALIZY.
