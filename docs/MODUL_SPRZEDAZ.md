# PÓŁECZKA IWONKI — MODUŁ SPRZEDAŻ

**Moduł:** 01 — SPRZEDAŻ  
**Status:** specyfikacja wdrożeniowa v0.2  
**Dokument nadrzędny:** `POLECZKA_PWA_MASTER.md`  
**Aktualizacja:** 17.09.2026

---

# 1. Cel modułu

Moduł SPRZEDAŻ ma zastąpić arkusz `SPRZEDAŻ` wygodnym widokiem PWA opartym bezpośrednio na danych z Cloudflare D1.

Moduł ma służyć do:

- szybkiego przeglądania paragonów,
- rozwijania pozycji konkretnego paragonu,
- filtrowania sprzedaży,
- wyszukiwania,
- kontroli rabatów,
- kontroli form płatności,
- kontroli przypisania pozycji do dostaw,
- prezentowania podstawowych wskaźników sprzedaży.

Moduł w v1 jest **widokiem i analizą danych**, a nie pełnym własnym POS-em.

---

# 2. Główne źródło danych

Dane sprzedaży pochodzą z:

`Loyverse -> webhook / API -> Cloudflare Worker -> D1 -> PWA`

PWA nie powinna pobierać sprzedaży bezpośrednio z Loyverse przy każdym wejściu na ekran.

D1 jest źródłem danych dla interfejsu.

## 2.1 Aktualne środowisko developerskie

Bieżąca baza developerska D1:

`poleczka-dev`

Aktualny zestaw tabel przeniesionych i obsługiwanych w tym środowisku obejmuje:

- `categories`,
- `items`,
- `receipts`,
- `receipt_lines`,
- `receipt_payments`,
- `webhook_events`.

Dla modułu SPRZEDAŻ listy wyboru, KPI, tabela paragonów i rozwijane pozycje mają być budowane na danych z `poleczka-dev`, bez tworzenia równoległych lokalnych słowników we frontendzie.

---

# 3. Obowiązujące dane

## 3.1 Paragon

Minimalny zestaw informacji wymagany w widoku paragonu:

- numer paragonu,
- data i czas,
- liczba pozycji,
- liczba sztuk,
- sprzedaż brutto,
- rabat,
- sprzedaż netto,
- forma płatności.

## 3.2 Pozycja paragonu

Minimalny zestaw informacji prezentowany w module:

- artykuł,
- kategoria,
- ilość,
- cena przed rabatem,
- rabat,
- wartość netto po rabacie,
- Lp. dostawy.

Identyfikatory techniczne:

- `item_id` — identyfikator artykułu,
- `line_id` — identyfikator pozycji sprzedaży,
- `variant_id` — pozostaje dostępny technicznie tam, gdzie jest potrzebny przez dane źródłowe.

## 3.3 SKU — obowiązująca zasada

SKU nie jest już elementem interfejsu modułu SPRZEDAŻ.

Obowiązuje:

- SKU nie jest wyświetlane w tabeli ani w szczegółach pozycji,
- SKU nie jest używane przez wyszukiwarkę,
- SKU nie jest podstawowym identyfikatorem artykułu w PWA,
- identyfikację artykułu opieramy na `item_id`,
- identyfikację pozycji sprzedaży opieramy na `line_id`,
- w `poleczka-dev` SKU pozostaje na razie jako kolumna techniczna w danych sprzedażowych,
- nie projektujemy nowych mechanizmów aplikacji opartych na SKU.

W przyszłości kolumna SKU może zostać usunięta z bazy ze względu na oszczędność miejsca i limity D1, ale dopiero po technicznym potwierdzeniu, że żaden aktywny import, webhook, Worker ani proces historyczny jej nie wykorzystuje.

---

# 4. Reguły Lp. dostawy

Kanonicznym numerem dostawy używanym przez moduł SPRZEDAŻ jest:

`receipt_lines.delivery_number`

Surowa wartość z Loyverse / importów pozostaje w `receipt_lines.line_note` i nie jest usuwana.

Obowiązujące reguły:

- `line_note = 0` -> `delivery_number = 0` -> dostawa wewnętrzna,
- pusty `line_note` -> `delivery_number = -1` -> niezidentyfikowana,
- numer nieistniejący aktualnie w tabeli `deliveries` -> tymczasowo `delivery_number = -1`,
- po dopisaniu brakującej dostawy trigger D1 automatycznie przypisuje pasujące pozycje do prawidłowego `delivery_number`,
- oryginalna wartość `line_note` pozostaje zachowana do diagnostyki i kontroli źródła.

---

# 5. Układ ekranu

## 5.1 Nagłówek

Tytuł:

**Sprzedaż**

Podtytuł:

**Tu znajdziesz wszystkie paragony i szczegóły sprzedaży.**

Po prawej stronie globalny pasek aplikacji:

- data,
- powiadomienia,
- status synchronizacji,
- profil / ustawienia użytkownika.

## 5.2 Zasada zgodności z layoutem głównym

Zaakceptowany wzorzec graficzny modułu SPRZEDAŻ dotyczy głównej zawartości modułu: KPI, filtrów, tabeli paragonów, rozwijanych pozycji i paginacji.

Lewy panel menu oraz górny panel z materiału referencyjnego są nieaktualne i **nie są kopiowane**.

Moduł SPRZEDAŻ używa aktualnego globalnego menu bocznego i aktualnego górnego nagłówka dokładnie w tym samym standardzie, co bieżący moduł główny / dashboard.

---

# 6. Górne wskaźniki

Na ekranie wyświetlamy 6 kafelków:

1. **Paragony**
2. **Sprzedane sztuki**
3. **Sprzedaż brutto**
4. **Rabaty**
5. **Sprzedaż netto**
6. **Średni paragon**

Wartości liczone dla aktualnie wybranego zakresu i filtrów.

## Formuły

### Paragony
Liczba unikalnych paragonów.

### Sprzedane sztuki
Suma ilości pozycji.

### Sprzedaż brutto
Suma wartości przed rabatem.

### Rabaty
Suma rabatów.

### Sprzedaż netto
Suma sprzedaży po rabatach.

### Średni paragon

`sprzedaż netto / liczba paragonów`

Jeżeli liczba paragonów = 0:

`0,00 zł`

---

# 7. Pasek filtrów

Kolejność:

1. zakres dat,
2. forma płatności,
3. kategoria,
4. artykuł,
5. wyszukiwarka.

## 7.1 Zakres dat

Domyślnie:

**bieżący miesiąc**

W selektorze dat dostępne są szybkie preselekcje:

- **Dzisiaj** — bieżący dzień,
- **7 dni** — bieżący dzień oraz 6 poprzednich dni,
- **Miesiąc** — bieżący miesiąc kalendarzowy.

Kliknięcie preselekcji ustawia pola **Od / Do**. Filtrowanie KPI i tabeli następuje po kliknięciu **Zastosuj**, dzięki czemu zakres można jeszcze ręcznie skorygować.

Dalsze szybkie opcje mogą zostać dodane później, np.:

- wczoraj,
- ostatnie 30 dni,
- poprzedni miesiąc,
- bieżący kwartał.

## 7.2 Forma płatności

Lista:

- Wszystkie,
- wartości dostępne w `receipt_payments` w D1.

Lista wyboru ma być zasilana z `poleczka-dev`, a nie z danych zaszytych we frontendzie.

## 7.3 Kategoria

Lista:

- Wszystkie,
- kategorie dostępne w tabeli `categories` w D1.

Lista wyboru ma być zasilana z `poleczka-dev`.

## 7.4 Artykuł

Lista:

- Wszystkie,
- artykuły dostępne w tabeli `items` w D1.

Po wyborze kategorii lista artykułów może zostać ograniczona do artykułów należących do tej kategorii.

Lista wyboru ma być zasilana z `poleczka-dev`.

## 7.5 Wyszukiwarka

Wyszukiwarka ma przeszukiwać:

- numer paragonu,
- nazwę artykułu,
- numer dostawy.

Mapowanie numeru dostawy:

`receipt_lines.delivery_number`

SKU **nie jest** elementem wyszukiwania.

Forma płatności pozostaje osobnym filtrem i nie musi być dublowana w wyszukiwarce.

---

# 8. Tabela paragonów

Każdy paragon jest **jednym głównym wierszem**.

Nie pokazujemy jednej pozycji sprzedaży jako osobnego głównego wiersza.

## Kolumny

1. rozwijanie `+ / -`
2. Paragon
3. Data
4. Pozycji
5. Szt.
6. Brutto
7. Rabat
8. Netto
9. Płatność
10. menu `...`

---

# 9. Rozwijanie paragonu

Przy każdym paragonie znajduje się przycisk:

`+`

Po kliknięciu:

- zmienia się w `-`,
- pod paragonem pojawia się tabela pozycji,
- rozwinięcie nie powinno przeładowywać całego ekranu.

W pierwszej wersji dopuszczamy rozwinięcie wielu paragonów jednocześnie.

---

# 10. Tabela pozycji paragonu

Kolumny:

1. Artykuł
2. Kategoria
3. Ilość
4. Cena
5. Rabat
6. Netto
7. Lp. dostawy

SKU nie jest wyświetlane.

Opcjonalnie w menu szczegółowym / technicznym:

- `item_id`,
- `variant_id`,
- `line_id`,
- pełne znaczniki czasu,
- dane techniczne synchronizacji.

---

# 11. Zebra

Zebra działa osobno dla dwóch poziomów.

## 11.1 Paragony

Naprzemienne delikatne tło:

- paragon A — białe,
- paragon B — bardzo jasne beżowe / szare,
- paragon C — białe.

## 11.2 Pozycje rozwiniętego paragonu

W obrębie rozwinięcia stosujemy osobną, subtelniejszą zebrę.

Kolorystyka pozycji nie może być kontynuacją zebry paragonów.

Cel:

paragon ma być wizualnie jedną całością.

---

# 12. Sortowanie

Domyślne:

`data malejąco`

czyli najnowsze paragony na górze.

Sortowanie dostępne minimum dla:

- daty,
- brutto,
- rabatu,
- netto,
- liczby sztuk.

---

# 13. Paginacja

Nie pobieramy całej historii do przeglądarki.

Domyślnie:

`25 paragonów / stronę`

Opcje:

- 25,
- 50,
- 100.

Backend zwraca:

- rekordy,
- numer strony,
- liczbę stron,
- całkowitą liczbę paragonów.

---

# 14. API modułu

Proponowane endpointy Workera.

## 14.1 Lista paragonów

`GET /api/sales/receipts`

Parametry:

- `from`
- `to`
- `payment`
- `category`
- `item`
- `search`
- `sort`
- `order`
- `page`
- `pageSize`

Parametr `search` obejmuje numer paragonu, nazwę artykułu i numer dostawy (`delivery_number`). Nie obejmuje SKU.

Przykład:

`GET /api/sales/receipts?from=2026-09-01&to=2026-09-30&page=1&pageSize=25`

Odpowiedź:

```json
{
  "ok": true,
  "page": 1,
  "pageSize": 25,
  "total": 48,
  "items": []
}
```

---

## 14.2 Pozycje paragonu

`GET /api/sales/receipts/:receiptNumber/lines`

Odpowiedź zawiera pozycje danego paragonu.

---

## 14.3 Wskaźniki

`GET /api/sales/summary`

Parametry filtrów takie same jak dla listy.

Odpowiedź:

```json
{
  "receipts": 48,
  "units": 102,
  "gross": 4334.62,
  "discount": 365.88,
  "net": 3968.74,
  "averageReceipt": 82.68
}
```

---

## 14.4 Filtry / słowniki

Możemy użyć wspólnych endpointów:

`GET /api/dictionaries/categories`

`GET /api/dictionaries/items`

`GET /api/dictionaries/payment-types`

Źródła danych w `poleczka-dev`:

- kategorie -> `categories`,
- artykuły -> `items`,
- formy płatności -> `receipt_payments`.

---

# 15. Zapytania D1 — zasada

Agregacje wykonujemy po stronie D1 / Workera.

Frontend nie powinien:

- pobierać tysięcy linii,
- samodzielnie liczyć wszystkich paragonów,
- samodzielnie grupować całej historii.

Frontend otrzymuje dane gotowe do prezentacji.

---

# 16. Model odpowiedzi paragonu

Docelowy obiekt frontendowy:

```json
{
  "receiptNumber": "2-0048",
  "date": "2026-09-15T12:24:10+02:00",
  "positions": 3,
  "units": 5,
  "gross": 214.00,
  "discount": 14.00,
  "net": 200.00,
  "payment": "Gotówka"
}
```

---

# 17. Model odpowiedzi pozycji

```json
{
  "lineId": "abc123",
  "itemId": "item-123",
  "itemName": "Bluzka",
  "category": "GÓRA",
  "quantity": 1,
  "price": 49.00,
  "discount": 4.00,
  "net": 45.00,
  "deliveryNo": 1
}
```

SKU nie jest częścią modelu prezentacyjnego odpowiedzi pozycji.

---

# 18. Responsywność

## Desktop
Pełna tabela jak w projekcie graficznym.

## Tablet
Tabela pozostaje głównym widokiem, część mniej istotnych kolumn może się zwijać.

## Telefon
Paragon może przejść z tabeli w kartę:

- numer,
- data,
- netto,
- płatność,
- sztuki,
- `+` do rozwinięcia.

Pozycje również jako kompaktowe karty.

---

# 19. Stany interfejsu

Muszą powstać stany:

### Ładowanie
Skeleton / delikatne placeholdery.

### Brak danych
Komunikat:

**Brak sprzedaży dla wybranych filtrów.**

### Błąd API
Komunikat:

**Nie udało się pobrać danych sprzedaży.**

Przycisk:

**Spróbuj ponownie**

### Offline
PWA powinna poinformować użytkownika, że widok może przedstawiać ostatnio zapisane dane.

---

# 20. Status synchronizacji

Ekran sprzedaży pokazuje globalnie:

- zsynchronizowano,
- czas ostatniej synchronizacji,
- stan błędu, jeżeli występuje.

Przykład:

**Zsynchronizowano — dzisiaj, 10:24**

---

# 21. Obliczenia pieniężne

W UI:

- waluta PLN,
- dwie cyfry po przecinku,
- polski zapis liczb.

Przykład:

`3 968,74 zł`

W obliczeniach backendu nie używamy niedokładnego sumowania wartości pieniężnych bez kontroli zaokrągleń.

Docelowo preferowane:
- wartości w groszach jako integer,
lub
- konsekwentne zaokrąglanie do 2 miejsc.

---

# 22. Dane i prywatność

Moduł sprzedaży v1 nie wymaga danych osobowych klientów.

Nie pobieramy ani nie przechowujemy danych klienta, jeżeli nie są potrzebne.

---

# 23. Menu kontekstowe `...`

W pierwszej wersji może zawierać:

- Szczegóły paragonu,
- Kopiuj numer paragonu,
- Pokaż dane techniczne.

Na tym etapie nie dodajemy:
- edycji historycznych paragonów,
- anulowania,
- zwrotów z poziomu naszej aplikacji.

---

# 24. Zakres v1 — czego NIE robimy w tym module

Nie budujemy jeszcze:

- własnego wystawiania paragonu,
- kasy POS,
- zwrotów,
- anulowań,
- korekt,
- faktur,
- rachunków,
- klientów,
- programu lojalnościowego.

Moduł jest na tym etapie widokiem sprzedaży i analizą danych z Loyverse/D1.

---

# 25. Komponenty frontendowe

Proponowana struktura:

```text
src/
  modules/
    sales/
      pages/
        SalesPage.tsx
      components/
        SalesKpiCards.tsx
        SalesFilters.tsx
        ReceiptsTable.tsx
        ReceiptRow.tsx
        ReceiptDetails.tsx
        ReceiptLinesTable.tsx
        SalesPagination.tsx
        SalesEmptyState.tsx
        SalesErrorState.tsx
      hooks/
        useSalesReceipts.ts
        useSalesSummary.ts
        useSalesFilters.ts
      api/
        salesApi.ts
      types/
        sales.ts
```

---

# 26. Stan filtrów w URL

Filtry warto synchronizować z adresem strony.

Przykład:

```text
/sprzedaz?from=2026-09-01&to=2026-09-30&category=GÓRA&page=1
```

Korzyści:

- odświeżenie strony zachowuje filtry,
- można skopiować link do konkretnego widoku,
- przeglądarka poprawnie obsługuje wstecz/dalej.

---

# 27. Wymagania wydajnościowe

Przy typowej bazie:

- ekran powinien otwierać się praktycznie natychmiast,
- rozwinięcie paragonu powinno być płynne,
- filtrowanie nie może wymagać pobierania całej historii.

Docelowo zapytania D1 mogą wymagać indeksów m.in. na:
- dacie paragonu,
- numerze paragonu,
- `item_id`,
- `delivery_number` dla wyszukiwania po numerze dostawy,
- polach powiązań potrzebnych do kategorii i płatności.

SKU nie jest planowane jako klucz wyszukiwania ani jako wymagany indeks dla modułu SPRZEDAŻ.

Indeksy dobieramy po sprawdzeniu realnych zapytań.

---

# 28. Kryteria odbioru modułu

Moduł SPRZEDAŻ uznajemy za gotowy w v1, gdy:

- [ ] ekran wizualnie odpowiada zaakceptowanemu projektowi,
- [ ] globalne menu boczne i górny nagłówek są zgodne z modułem głównym,
- [ ] KPI pobierają realne dane z D1,
- [ ] tabela pokazuje paragony, nie pojedyncze linie,
- [ ] `+` rozwija pozycje,
- [ ] pozycje mają osobną zebrę,
- [ ] działają filtry dat,
- [ ] działa filtr płatności z danych D1,
- [ ] działa filtr kategorii z `categories`,
- [ ] działa filtr artykułu z `items`,
- [ ] wyszukiwarka obsługuje numer paragonu, nazwę artykułu i numer dostawy,
- [ ] SKU nie jest wyświetlane ani wyszukiwane,
- [ ] działa sortowanie,
- [ ] działa paginacja,
- [ ] kwoty zgadzają się z D1,
- [ ] liczby sztuk zgadzają się z D1,
- [ ] rabaty zgadzają się z D1,
- [ ] Lp. dostawy jest poprawne,
- [ ] status synchronizacji jest widoczny,
- [ ] ekran działa na desktopie i tablecie,
- [ ] podstawowy widok mobilny działa poprawnie.

---

# 29. Kolejność implementacji

## Etap A — fundament
1. utworzenie projektu PWA,
2. router,
3. layout aplikacji,
4. menu boczne,
5. wspólna typografia i kolory.

## Etap B — backend sprzedaży
1. endpoint listy paragonów,
2. endpoint pozycji,
3. endpoint summary,
4. endpointy słowników.

## Etap C — ekran
1. KPI,
2. filtry,
3. tabela paragonów,
4. rozwijanie pozycji,
5. zebra,
6. paginacja.

## Etap D — wykończenie
1. stany błędów,
2. loading,
3. responsywność,
4. test porównawczy z D1,
5. dopracowanie wyglądu.

---

# 30. Następny krok techniczny

Aktualny schemat roboczy `poleczka-dev` obejmuje tabele wymagane przez ten moduł, w tym `categories`, `items`, `receipts`, `receipt_lines` i `receipt_payments`.

Następne kroki:

1. podpiąć endpointy sprzedaży do `poleczka-dev`,
2. zbudować / uzupełnić `/api/sales/summary`,
3. zbudować / uzupełnić `/api/sales/receipts`,
4. zasilić filtry rzeczywistymi danymi z `receipt_payments`, `categories` i `items`,
5. wdrożyć wyszukiwanie po numerze paragonu, nazwie artykułu i `delivery_number`,
6. podłączyć frontend do rzeczywistych odpowiedzi API,
7. wykonać test porównawczy wartości z D1.

---

# 31. Obowiązujący workflow pracy nad modułem SPRZEDAŻ

Dla modułu SPRZEDAŻ obowiązują wszystkie zasady zapisane w `POLECZKA_PWA_MASTER.md` oraz `AGENTS.md`.

Repozytorium `022IE/poleczka-pwa` jest źródłem prawdy. Nie przekazujemy użytkownikowi ZIP-ów jako podstawowego sposobu wdrażania zmian.

Gałęzie:
- `main` — stabilna,
- `dev` — wszystkie bieżące zmiany modułu SPRZEDAŻ,
- `pipeline-status` — tylko status bieżącej pracy.

### Przed zmianą w module

Pierwszą operacją zapisu musi być ustawienie w `pipeline-status/status/work-status.json`:

- `state = editing`,
- **Wprowadzanie poprawek**,
- opis konkretnego zadania sprzedażowego.

Przykład opisu:

`SPRZEDAŻ — dodanie filtra kategorii i poprawa tabeli paragonów`

Dopiero po tym wolno edytować kod na `dev`.

### Po zakończeniu zmian

Status przechodzi na **Oczekiwanie na publikację**, a dalsza ścieżka jest automatyczna:

`GitHub → Build → Cloudflare → Online`

Jeżeli równolegle pracuje inny czat, nie wolno usuwać jego aktywnego statusu; opis powinien uwzględnić równoległą pracę albo stan `editing` pozostaje aktywny do zakończenia wszystkich trwających zadań.

---

# 32. Widżet publikacji a ekran SPRZEDAŻ

Widżet pipeline jest elementem globalnego layoutu aplikacji, a nie komponentem biznesowym modułu SPRZEDAŻ.

Położenie w wersji developerskiej:
- w górnym panelu,
- pomiędzy **„Dzień dobry, Iwonko!”** a kalendarzem / ikonami.

Moduł SPRZEDAŻ musi respektować wysokość globalnego nagłówka i nie może nachodzić na widżet. Główna zawartość ekranu zaczyna się poniżej całego górnego panelu.

Widżet pokazuje:

`Prace → GitHub → Build → Cloudflare → Online`

Build oznacza wyłącznie rzeczywistą kompilację. Oczekiwanie na wdrożenie nie może utrzymywać kafelka Build w stanie „trwa”. Cloudflare jest osobnym etapem.

`Online` oznacza, że dokładnie bieżący commit / SHA jest potwierdzony jako wdrożony.

Aktualizacje są push przez WebSocket / Durable Object. Odpytanie HTTP jest tylko mechanizmem awaryjnym po utracie kanału LIVE.

Widżet jest tymczasowym narzędziem developerskim i ma zostać wyłączony w finalnej wersji produkcyjnej bez usuwania mechanizmu diagnostycznego.

---

# 33. Zasada aktualizacji specyfikacji modułu

Każda decyzja, która zmienia zachowanie modułu SPRZEDAŻ, jego dane, API, filtry, layout lub reguły biznesowe, powinna zostać dopisana do `docs/MODUL_SPRZEDAZ.md`.

Decyzje globalne, dotyczące więcej niż jednego modułu, trafiają także do `docs/POLECZKA_PWA_MASTER.md`.

Czat `01 — SPRZEDAŻ` służy do pracy nad modułem, ale nie jest jedynym źródłem prawdy. Obowiązujące ustalenia mają kończyć w repozytorium.

Sekcje 31–33 są nowsze i w razie konfliktu zastępują wcześniejsze informacje organizacyjne w tym dokumencie.

---

# 34. Ustalenia z 17.09.2026 — filtry, wyszukiwanie i SKU

Obowiązuje dla dalszego wdrażania modułu SPRZEDAŻ:

- środowisko developerskie korzysta z bazy `poleczka-dev`,
- lista form płatności korzysta z danych `receipt_payments`,
- lista kategorii korzysta z tabeli `categories`,
- lista artykułów korzysta z tabeli `items`,
- wyszukiwarka obejmuje numer paragonu, nazwę artykułu oraz numer dostawy z `receipt_lines.delivery_number`,
- SKU zostało wycofane z wyszukiwania,
- SKU zostało wycofane z wyświetlania,
- SKU pozostaje tymczasowo kolumną techniczną w D1,
- artykuł identyfikujemy przez `item_id`, a pozycję sprzedaży przez `line_id`,
- nowych funkcji nie budujemy w oparciu o SKU,
- ewentualne fizyczne usunięcie kolumny SKU z D1 jest decyzją przyszłą i wymaga osobnego audytu zależności przed migracją.


---

# 35. Stan wdrożenia z 18.09.2026 — dane D1 i zakres dat

W module SPRZEDAŻ wdrożono połączenie widoku z bazą developerską `poleczka-dev`.

## Backend / Worker

Dodane i używane przez frontend endpointy:

- `GET /api/dictionaries/categories` — aktywne kategorie z `categories`,
- `GET /api/dictionaries/items` — aktywne artykuły z `items`,
- `GET /api/dictionaries/payment-types` — formy płatności z `receipt_payments`,
- `GET /api/sales/summary` — KPI dla bieżących filtrów,
- `GET /api/sales/receipts` — stronicowana lista paragonów,
- `GET /api/sales/receipts/:receiptNumber/lines` — pozycje rozwijanego paragonu.

Zakres dat jest przekazywany do Workera jako daty `YYYY-MM-DD`. Granice dnia są przeliczane według strefy `Europe/Warsaw`, a następnie porównywane z timestampem `receipt_date`.

## Frontend

Ekran SPRZEDAŻ:

- nie korzysta już z demonstracyjnej listy paragonów ani demonstracyjnych KPI,
- pobiera KPI z D1,
- pobiera listę paragonów z D1,
- pobiera pozycje dopiero po rozwinięciu konkretnego paragonu,
- pobiera listy płatności, kategorii i artykułów z D1,
- po wyborze kategorii ogranicza listę artykułów do tej kategorii,
- wyszukuje po numerze paragonu, nazwie artykułu i numerze dostawy z `delivery_number`,
- nie wyświetla i nie wyszukuje SKU,
- posiada selektor zakresu dat z polami **Od** i **Do**,
- domyślnie ustawia bieżący miesiąc,
- posiada przycisk szybkiego ustawienia bieżącego miesiąca,
- obsługuje sortowanie po dacie, liczbie sztuk, brutto, rabacie i netto,
- obsługuje paginację 25 / 50 / 100 paragonów na stronę,
- posiada stany ładowania, braku danych i błędu API.

## Semantyka filtrów i KPI

Dla filtra kategorii lub artykułu KPI są liczone z pasujących pozycji sprzedaży, dzięki czemu np. sprzedaż netto dla wybranej kategorii oznacza sprzedaż pozycji tej kategorii, a nie całkowitą wartość wszystkich paragonów, na których taka kategoria wystąpiła.

Tabela główna nadal reprezentuje całe paragony. Jeżeli paragon spełnia filtr pozycji, jego główny wiersz pokazuje pełne wartości paragonu. Rozwinięcie pokazuje wszystkie pozycje tego paragonu, aby zachować pełny kontekst dokumentu sprzedaży.

SKU pozostaje wyłącznie techniczną kolumną w D1 i nie jest częścią modeli prezentacyjnych API modułu SPRZEDAŻ.


---

# 36. Sterowanie rozwinięciem wszystkich paragonów

W lewym górnym rogu tabeli paragonów znajduje się przycisk zbiorczy:

- `⊞` — rozwija wszystkie paragony aktualnie widoczne na bieżącej stronie,
- `⊟` — zwija wszystkie paragony aktualnie widoczne na bieżącej stronie.

Zasada wydajnościowa:
- funkcja działa wyłącznie na paragonach bieżącej strony paginacji,
- nie pobiera całej historii sprzedaży,
- pozycje brakujących paragonów są pobierane z API dopiero przy zbiorczym rozwinięciu,
- wcześniej pobrane pozycje pozostają w pamięci widoku i nie są pobierane ponownie przy kolejnym rozwinięciu.


---

# 37. Kanoniczne `delivery_number` — migracja 18.09.2026

Od 18.09.2026 moduł SPRZEDAŻ nie interpretuje numeru dostawy bezpośrednio z `line_note`.

Obowiązujący model:
- `receipt_lines.line_note` — surowa notatka / komentarz pochodzący z Loyverse lub importu, zachowywany do audytu i diagnostyki,
- `receipt_lines.delivery_number` — kanoniczny numer dostawy używany przez API, wyszukiwanie i interfejs,
- `receipt_lines.delivery_number -> deliveries.delivery_number` — relacja z tabelą dostaw.

Kompatybilność:
- live Worker Loyverse może nadal zapisywać `line_note`,
- istniejące importy historyczne mogą nadal zapisywać `line_note`,
- istniejące korekty `line_note` pozostają wspierane,
- triggery D1 po każdym INSERT / UPDATE synchronizują `delivery_number`,
- brakujący lub nierozpoznany numer daje `delivery_number = -1`,
- dodanie brakującej dostawy do `deliveries` automatycznie rozwiązuje pasujące pozycje.

Warstwa odczytu PWA korzysta z `delivery_number`; nie należy budować nowych funkcji biznesowych bezpośrednio na `line_note`.


---

# 38. Pole S.K. paragonu — 18.09.2026

Do tabeli `receipts` dodano lokalne pole:

- nazwa techniczna: `sk`,
- typ logiczny: boolean,
- wartość domyślna: `true`,
- pole nie pochodzi z Loyverse,
- synchronizacja Loyverse nie jest źródłem wartości S.K.

W tabeli głównej SPRZEDAŻY znajduje się kolumna **S.K.** z checkboxem dla każdego paragonu.

Zachowanie:
- zaznaczony checkbox = `sk = true`,
- odznaczony checkbox = `sk = false`,
- zmiana checkboxa zapisuje wartość do D1 przez endpoint:
  `PATCH /api/sales/receipts/:receiptNumber/sk`,
- zapis jest wykonywany optymistycznie; w przypadku błędu checkbox wraca do poprzedniej wartości,
- nowy paragon bez jawnie podanej wartości otrzymuje `sk = true` z domyślnej wartości D1.

Pole S.K. jest własnym polem biznesowym PWA i nie może być uzależnione od danych zwracanych przez Loyverse.
