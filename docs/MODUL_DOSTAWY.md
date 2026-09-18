# PÓŁECZKA IWONKI — MODUŁ DOSTAWY

**Moduł:** DOSTAWY  
**Status:** model danych wdrożony v0.1  
**Dokument nadrzędny:** `POLECZKA_PWA_MASTER.md`  
**Aktualizacja:** 18.09.2026

---

## 1. Cel

Moduł DOSTAWY ma przechowywać dane wejściowe o dostawach i stanowić jednoznaczne źródło kosztu oraz ilości przyjętej dla pozycji sprzedaży.

D1 używa angielskich nazw tabel i pól. Nazwy biznesowe dostawców pozostają w języku źródłowym.

---

## 2. Tabela `deliveries`

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

Znaczenie pól:
- `delivery_number` — numer / Lp. dostawy i klucz główny,
- `delivery_date` — data dostawy,
- `supplier_name` — dostawca,
- `quantity` — liczba sztuk przyjętych,
- `total_cost` — łączny koszt dostawy,
- `created_at`, `updated_at` — znaczniki techniczne.

Koszt jednostkowy nie jest przechowywany jako osobne źródło prawdy. Wyliczamy go jako:

`total_cost / quantity`

---

## 3. Dane startowe

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

Rekordy specjalne:
- `-1` — dostawa niezidentyfikowana,
- `0` — dostawa wewnętrzna.

---

## 4. Powiązanie ze sprzedażą

Kanoniczna relacja:

`receipt_lines.delivery_number -> deliveries.delivery_number`

`receipt_lines.line_note` pozostaje surową wartością źródłową z Loyverse / importów.

Nie usuwamy `line_note`, ponieważ:
- pozwala zachować oryginalny komentarz,
- umożliwia diagnostykę błędnego lub brakującego numeru,
- utrzymuje zgodność z live webhookiem Loyverse,
- utrzymuje zgodność ze starszymi importami i workflow korekt.

---

## 5. Reguły mapowania

Po INSERT lub zmianie `receipt_lines.line_note`:
- jeżeli surowa wartość odpowiada istniejącemu `deliveries.delivery_number`, ustawiany jest ten numer,
- puste `line_note` daje `delivery_number = -1`,
- nierozpoznany numer daje tymczasowo `delivery_number = -1`,
- `line_note = 0` daje `delivery_number = 0`.

Po dodaniu nowej dostawy:
- D1 wyszukuje pozycje z pasującym surowym `line_note`,
- ich `delivery_number` jest automatycznie aktualizowany.

Mechanizm realizują triggery:
- `trg_receipt_lines_delivery_insert`,
- `trg_receipt_lines_delivery_note_update`,
- `trg_deliveries_resolve_lines`.

---

## 6. Zależne mechanizmy

### Live Worker Loyverse

Worker `poleczka-loyverse-webhook` nadal zapisuje surowe `line_note`.
Nie wymaga to równoległego zapisu `delivery_number`, ponieważ kanonizacja odbywa się w D1.

Audyt wdrożenia z 18.09.2026 potwierdził cztery techniczne wystąpienia `line_note` w live Workerze; dotyczą pobrania i zapisu wartości źródłowej.

### Importy historyczne

Dotychczasowe skrypty importu mogą nadal podawać `line_note`.
Trigger INSERT wypełni `delivery_number`.

### Korekty

Dotychczasowe workflow korygujące `line_note` pozostają kompatybilne.
Trigger UPDATE synchronizuje odpowiadający `delivery_number`.

### PWA

Nowe odczyty biznesowe, wyszukiwanie i przyszłe analizy mają korzystać z `delivery_number`, nie z `line_note`.

---

## 7. Weryfikacja migracji 18.09.2026

Migracja na `poleczka-dev` zakończyła się poprawnie.

Potwierdzono:
- 9 rekordów startowych w `deliveries`,
- `delivery_number` w `receipt_lines`,
- indeks `idx_lines_delivery`,
- brak wartości NULL w `receipt_lines.delivery_number`,
- brak błędów `PRAGMA foreign_key_check`,
- 0 nierozwiązanych niepustych surowych `line_note`,
- zgodność istniejących pozycji z numerami dostaw.

---

## 8. Zasada kosztu i rentowności

Dla dostawy:

`unit_cost = total_cost / quantity`

Dla sprzedanej pozycji:

`sold_cost = unit_cost × sold_quantity`

Szacowany zysk:

`estimated_profit = net_sales - sold_cost`

Nie używamy `receipt_lines.cost` ani `receipt_lines.cost_total` jako źródła kosztu modułu DOSTAWY.

---

## 9. Następny zakres modułu

Sama migracja modelu danych nie oznacza jeszcze pełnego wdrożenia ekranu DOSTAWY.

Kolejne elementy UI / API mogą obejmować:
- listę dostaw,
- filtry,
- sprzedane sztuki,
- % zbytu,
- sprzedaż przypisaną do dostawy,
- koszt sprzedanych sztuk,
- zysk,
- analizy dostawców i dostaw.

Te funkcje mają opierać się wyłącznie na kanonicznym `delivery_number`.

---

## 10. Widok modułu DOSTAWY — wdrożenie 18.09.2026

Ekran `/dostawy` ma następujący układ:

1. KPI u góry:
   - aktywne dostawy,
   - sztuk przyjęto,
   - % zbytu,
   - sprzedaż z dostaw,
   - szacowany zysk,
   - najlepszy dostawca.
2. Poniżej jedna tabela dostaw.
3. Filtry są umieszczone w nagłówku karty tabeli:
   - data od / do,
   - dostawca,
   - status,
   - kategoria,
   - wyszukiwarka po Lp. i dostawcy.
4. W nagłówku tabeli są akcje:
   - **Rozwiń wszystko / Zwiń wszystko**,
   - **Dodaj dostawę**.
5. Każdą dostawę można rozwinąć przyciskiem `+` analogicznie do paragonów w module SPRZEDAŻ.
6. Rozwinięcie pokazuje zagregowane sprzedane artykuły z tej dostawy, np. `Spodnie — 25 szt.`, `Koszula — 10 szt.`.
7. Wiersze artykułów, dla których zagregowana sprzedaż ilościowa wynosi `0`, **nie są wyświetlane**.
8. **Dostawa nr 0 jest normalnie wyświetlana** w tabeli i może być rozwijana. Reguła ukrywania zera dotyczy wyłącznie artykułów z zerową sprzedażą w rozwinięciu, nie numeru dostawy.

Tabela główna pokazuje:
- Lp.,
- datę,
- dostawcę,
- ilość,
- cenę/szt.,
- sprzedane,
- % zbytu,
- % zwrotu,
- sprzedaż,
- zysk.

Definicje:
- `unit_cost = total_cost / quantity`,
- `sell_through = sold / quantity × 100%`,
- `return_rate = sales / total_cost × 100%`,
- `profit = sales - sold × unit_cost`.

Formularz **Dodaj dostawę** zapisuje:
- datę,
- dostawcę,
- ilość,
- koszt całkowity.

`delivery_number` dla nowej zwykłej dostawy jest nadawany automatycznie jako kolejny dodatni numer.

