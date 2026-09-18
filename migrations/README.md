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

