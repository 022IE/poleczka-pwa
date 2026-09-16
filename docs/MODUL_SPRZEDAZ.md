# PÓŁECZKA IWONKI — MODUŁ SPRZEDAŻ

**Moduł:** 01 — SPRZEDAŻ  
**Status:** specyfikacja wdrożeniowa v0.1  
**Dokument nadrzędny:** `POLECZKA_PWA_MASTER.md`  
**Aktualizacja:** 16.09.2026

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

Minimalny zestaw informacji:

- artykuł,
- kategoria,
- SKU,
- ilość,
- cena przed rabatem,
- rabat,
- wartość netto po rabacie,
- Lp. dostawy,
- ID pozycji / rekord techniczny.

---

# 4. Reguły Lp. dostawy

Źródłem numeru dostawy jest:

`receipt_lines.line_note`

Obowiązujące reguły:

- `line_note = 0` -> dostawa wewnętrzna,
- pusty `line_note` -> `-1`, niezidentyfikowana,
- numer dostawy nieistniejący aktualnie w tabeli dostaw -> tymczasowo `-1`,
- po dopisaniu brakującej dostawy kolejna synchronizacja ma przypisać pozycję do prawidłowej dostawy,
- oryginalna wartość z D1 nie może zostać bezpowrotnie utracona.

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

Szybkie opcje w przyszłości:

- dziś,
- wczoraj,
- ostatnie 7 dni,
- ostatnie 30 dni,
- bieżący miesiąc,
- poprzedni miesiąc,
- bieżący kwartał,
- własny zakres.

## 7.2 Forma płatności

Lista:

- Wszystkie,
- wartości dostępne w bazie.

## 7.3 Kategoria

Lista:

- Wszystkie,
- kategorie dostępne w D1.

## 7.4 Artykuł

Lista:

- Wszystkie,
- artykuły dostępne w D1.

Po wyborze kategorii lista artykułów może zostać ograniczona do artykułów tej kategorii.

## 7.5 Wyszukiwarka

Powinna wyszukiwać minimum po:

- numerze paragonu,
- nazwie artykułu,
- SKU.

Docelowo możliwe rozszerzenie:

- numer dostawy,
- forma płatności.

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
3. SKU
4. Ilość
5. Cena
6. Rabat
7. Netto
8. Lp. dostawy

Opcjonalnie w menu szczegółowym:

- item_id,
- variant_id,
- line_id,
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
  "itemName": "Bluzka",
  "category": "GÓRA",
  "sku": "BLU-019",
  "quantity": 1,
  "price": 49.00,
  "discount": 4.00,
  "net": 45.00,
  "deliveryNo": 1
}
```

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

Docelowo zapytania D1 wymagają indeksów m.in. na:
- dacie paragonu,
- numerze paragonu,
- SKU,
- item_id / variant_id tam, gdzie potrzebne.

Indeksy dobieramy po sprawdzeniu realnych zapytań.

---

# 28. Kryteria odbioru modułu

Moduł SPRZEDAŻ uznajemy za gotowy w v1, gdy:

- [ ] ekran wizualnie odpowiada zaakceptowanemu projektowi,
- [ ] KPI pobierają realne dane z D1,
- [ ] tabela pokazuje paragony, nie pojedyncze linie,
- [ ] `+` rozwija pozycje,
- [ ] pozycje mają osobną zebrę,
- [ ] działają filtry dat,
- [ ] działa filtr płatności,
- [ ] działa filtr kategorii,
- [ ] działa filtr artykułu,
- [ ] działa wyszukiwarka,
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

Przed napisaniem kodu należy:

1. potwierdzić aktualny schemat tabel D1,
2. ustalić, gdzie dokładnie przechowywana jest forma płatności,
3. przygotować pierwsze zapytanie SQL grupujące `receipt_lines` do poziomu paragonu,
4. zbudować endpoint `/api/sales/summary`,
5. zbudować endpoint `/api/sales/receipts`.

Po tym zaczynamy frontend.
