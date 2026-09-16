# PÓŁECZKA IWONKI — PWA MASTER

**Status:** dokument główny projektu  
**Rola:** jedno źródło prawdy dla całej aplikacji PWA  
**Aktualizacja bazowa:** 16.09.2026

---

## 1. Cel projektu

Celem jest stworzenie lekkiej, estetycznej i wygodnej aplikacji PWA dla małej sprzedaży prowadzonej w ramach działalności nierejestrowanej.

Pierwsza wersja PWA ma odtworzyć i rozwinąć funkcje, które obecnie działają w arkuszu LibreOffice, ale w formie wygodniejszej w obsłudze, atrakcyjniejszej wizualnie i bez ograniczeń typowych dla arkusza.

Na tym etapie **nie budujemy pełnego systemu dla JDG, VAT ani pełnej księgowości**.

---

## 2. Zakres wersji 1

W wersji 1 aplikacja obejmuje:

- stronę główną / dashboard,
- sprzedaż,
- dostawy,
- koszty,
- artykuły,
- kategorie,
- analizy,
- synchronizację,
- ustawienia,
- kontrolę limitu działalności nierejestrowanej,
- przechowywanie dokumentów kosztowych poza D1.

### Rabaty — aktualne ustalenie

W v1 **nie konfigurujemy rabatów w PWA** i nie utrzymujemy osobnego modułu konfiguracji rabatów.

Rabaty są na razie obsługiwane tak jak dotychczas, czyli **z poziomu systemu POS / Loyverse**.

PWA:
- odczytuje dane o rabatach ze sprzedaży,
- pokazuje kwoty rabatów w paragonach, KPI i analizach,
- nie tworzy, nie edytuje, nie aktywuje i nie usuwa definicji rabatów.

Osobny moduł zarządzania rabatami może wrócić w przyszłym etapie.

---

## 3. Architektura

### Frontend
- PWA,
- React + Vite,
- responsywna aplikacja instalowalna na komputerze, tablecie i telefonie.

### Backend
- Cloudflare Worker,
- Cloudflare D1 jako główna baza danych.

### Źródła danych
- Loyverse API,
- webhook Loyverse,
- dane własne aplikacji.

### Dokumenty
- Google Drive użytkownika,
- D1 przechowuje tylko metadane i powiązania do plików.

### Przepływ danych

`Loyverse -> Webhook / API -> Cloudflare Worker -> D1 -> PWA`

Dokumenty kosztowe:

`PWA -> Google Drive użytkownika`

---

## 4. Zasady ogólne

- D1 jest głównym trwałym źródłem danych.
- PWA jest warstwą prezentacji i obsługi.
- Nie przechowujemy zdjęć ani PDF-ów dokumentów kosztowych w D1.
- Każdy klient docelowo korzysta z własnego konta Cloudflare, własnej D1 i własnego Google Drive.
- Tokeny API i dane dostępowe powinien wprowadzać sam użytkownik.
- Krytyczne reguły biznesowe nie mogą być rozproszone wyłącznie po czatach — trafiają do MASTER lub specyfikacji modułów.

---

## 5. Styl aplikacji

### Charakter
- jasny,
- elegancki,
- butikowy,
- spokojny,
- premium,
- dużo światła i przestrzeni,
- zaokrąglone kafelki,
- delikatne cienie,
- subtelne pastele,
- złote / beżowe akcenty,
- zieleń jako kolor wskaźników pozytywnych.

### Branding
Marka: **Półeczka Iwonki**

Kierunek wizualny:
- logo / monogram P-I,
- złoty kontur wieszaka,
- styl minimalistyczny i premium.

W aplikacji nazwa i branding mają docelowo być możliwe do zmiany w konfiguracji.

---

## 6. Strona główna

### Główne wskaźniki
- sprzedaż dziś,
- sprzedaż w bieżącym kwartale,
- szacowany zysk,
- liczba sprzedanych sztuk,
- średnia wartość paragonu,
- % zbytu.

### Działalność nierejestrowana
Panel pokazuje:
- bieżący kwartał,
- kwotę wykorzystaną,
- obowiązujący limit,
- procent wykorzystania,
- kwotę pozostałą,
- pasek postępu,
- ostrzeżenia po przekroczeniu progów.

Limit:
- jest kwartalny,
- nie może być na stałe wpisany w kod,
- musi być konfigurowalny.

### Wykresy
- sprzedaż w czasie,
- porównanie tygodni,
- sprzedaż wg kategorii,
- heatmapa dzień tygodnia × godzina.

---

## 7. Moduł SPRZEDAŻ

### Widok główny
Górne wskaźniki:
- liczba paragonów,
- liczba sprzedanych sztuk,
- sprzedaż brutto,
- rabaty,
- sprzedaż netto,
- średni paragon.

**Rabaty w tym module są wyłącznie danymi odczytanymi z POS/Loyverse. Nie konfigurujemy ich w PWA.**

### Filtry
- zakres dat,
- forma płatności,
- kategoria,
- artykuł,
- wyszukiwarka.

### Tabela paragonów
Każdy paragon jest jednym głównym wierszem.

Kolumny:
- numer paragonu,
- data,
- liczba pozycji,
- liczba sztuk,
- brutto,
- rabat,
- netto,
- płatność.

Po kliknięciu `+` paragon rozwija swoje pozycje.

### Pozycje
- artykuł,
- kategoria,
- SKU,
- ilość,
- cena,
- rabat,
- netto,
- Lp. dostawy.

### Zebra
Osobna zebra dla paragonów i osobna dla pozycji rozwiniętego paragonu.

---

## 8. Reguły sprzedaży i dostaw

Pole Loyverse `line_note / komentarz` jest numerem Lp. dostawy.

Reguły:
- `0` = dostawa wewnętrzna,
- pusty komentarz = `-1` niezidentyfikowana,
- numer dostawy nieistniejący aktualnie w tabeli dostaw = tymczasowo `-1`,
- przy kolejnej synchronizacji, jeżeli dana dostawa już istnieje, pozycja ma zostać ponownie przypisana prawidłowo.

---

## 9. Moduł DOSTAWY

### Górne wskaźniki
- aktywne dostawy,
- sztuk przyjęto,
- % zbytu,
- sprzedaż z dostaw,
- szacowany zysk,
- najlepszy dostawca.

### Filtry
- zakres dat,
- dostawca,
- status,
- kategoria,
- wyszukiwarka.

### Tabela
- Lp. dostawy,
- data,
- dostawca,
- kategoria główna,
- ilość,
- sprzedane,
- % zbytu,
- % zwrotu,
- sprzedaż zł,
- zysk.

### Analizy
- sprzedaż wg dostawcy,
- rentowność dostaw,
- krzywa % zbytu w czasie,
- % zbytu vs zysk,
- Pareto 80/20.

---

## 10. Moduł KOSZTY

### Górne wskaźniki
- koszty dziś,
- koszty w kwartale,
- liczba dokumentów,
- średni koszt,
- największa kategoria kosztowa,
- udział kosztów w przychodzie.

### Dokumenty
Każdy koszt może mieć jeden lub wiele dokumentów.

Obsługiwane przykłady:
- zdjęcie paragonu,
- PDF faktury,
- potwierdzenie przelewu,
- inny załącznik.

Pliki fizyczne przechowuje Google Drive użytkownika, a D1 tylko identyfikatory i metadane.

Docelowa tabela: `cost_documents`.

---

## 11. Rabaty

### Stan obowiązujący w v1

Rabaty **nie są osobnym modułem konfiguracyjnym PWA**.

Źródłem definicji i sposobu stosowania rabatów pozostaje POS / Loyverse.

PWA ma zachować i analizować dane przesłane ze sprzedaży, w szczególności:
- wartość rabatu pozycji,
- wartość rabatu paragonu, jeśli jest dostępna w danych źródłowych,
- kwotę przed rabatem,
- kwotę po rabacie.

Nie wdrażamy w v1:
- CRUD rabatów,
- aktywacji / dezaktywacji rabatów,
- kolejności kafelków rabatowych,
- przypinania rabatów do kafelków z poziomu PWA,
- własnej tabeli definicji rabatów jako elementu konfiguracji aplikacji.

---

## 12. Moduł ANALIZY

### Filtry wspólne
- zakres dat,
- kategoria,
- artykuł,
- dostawca,
- dostawa.

### Podstawowe analizy
- sprzedaż brutto,
- rabaty,
- sprzedaż netto,
- zysk,
- sprzedaż w czasie,
- sprzedaż wg kategorii.

Rabaty w analizach pochodzą z danych sprzedażowych POS/Loyverse.

### Porównanie wielu okresów
Przykład: `7 | dni | 10 okresów`.

Efekt:
- jeden wykres,
- wiele linii,
- każda linia = osobny okres,
- najnowszy okres wyróżniony.

### Heatmapa
Dzień tygodnia × godzina.

### Histogram cen
Analiza przedziałów cenowych wg liczby sztuk i wartości sprzedaży.

---

## 13. Moduł USTAWIENIA

### Firma
- nazwa firmy / marki,
- tryb firmy,
- waluta,
- strefa czasowa,
- język.

Na tym etapie obowiązuje `Działalność nierejestrowana`.

### Limit działalności nierejestrowanej
- okres limitu: kwartalny,
- aktualny limit,
- bieżący kwartał,
- progi ostrzeżeń,
- bieżące wykorzystanie.

### Integracje
- Loyverse API,
- Cloudflare D1,
- Google Drive.

### Słowniki
- Kategorie,
- Artykuły,
- Dostawcy,
- Formy płatności.

### Rabaty
**Brak konfiguracji rabatów w USTAWIENIACH w v1.** Rabaty pozostają obsługiwane w POS/Loyverse.

### Wygląd
- motyw,
- widok startowy,
- układ menu bocznego,
- wersja aplikacji.

---

## 14. Synchronizacja

Obecny model:

`Loyverse -> D1 -> aplikacja`

Należy zachować:
- webhooki,
- import historii,
- automatyczną synchronizację,
- status ostatniej synchronizacji,
- komunikaty o błędach.

---

## 15. Dane historyczne i obecny model D1

Aktualnie działający model obejmuje m.in.:

### `webhook_events`
- event_id,
- received_at,
- event_type,
- merchant_id,
- event_created_at,
- receipt_numbers_json,
- next_index,
- attempts,
- processed_at,
- last_error.

### `receipts`
- receipt_number,
- receipt_type,
- refund_for,
- source,
- receipt_date,
- created_at,
- updated_at,
- cancelled_at,
- store_id,
- pos_device_id,
- total_money,
- total_discount,
- total_tax,
- tip,
- surcharge,
- synced_at.

### `receipt_lines`
- line_id,
- receipt_number,
- item_id,
- variant_id,
- item_name,
- variant_name,
- sku,
- quantity,
- price,
- gross_total_money,
- total_money,
- cost,
- cost_total,
- total_discount,
- line_note.

Dalsze tabele będą projektowane modułowo.

---

## 16. Formy płatności

Forma płatności jest obowiązkową informacją sprzedaży.

Musi być:
- zapisana w D1,
- widoczna przy paragonie,
- dostępna jako filtr.

---

## 17. Kategorie i artykuły

Kategorie i artykuły:
- pochodzą z D1 / Loyverse,
- są dostępne w słownikach,
- są używane w filtrach,
- mogą być używane w analizach.

Listy filtrów zawsze mają opcję `Wszystkie`.

---

## 18. Działalność nierejestrowana

W v1 obowiązuje:
- kontrola kwartalnego limitu,
- możliwość konfiguracji limitu,
- panel wykorzystania limitu na stronie głównej,
- ostrzeżenia progowe.

Poza v1 pozostają m.in. JDG, pełny VAT, pełna księgowość i automatyczne składanie PIT.

---

## 19. Potencjalny przyszły zakres — NIE v1

Do późniejszego rozważenia:
- pełny własny POS,
- odejście od Loyverse,
- własna konfiguracja i obsługa rabatów,
- faktury,
- rachunki,
- paragony / dokumenty sprzedaży,
- raport PIT,
- VAT,
- JDG,
- pełniejsza księgowość,
- korekty,
- anulowania,
- wielu użytkowników,
- role i uprawnienia,
- wersja komercyjna dla wielu firm.

---

## 20. Model komercyjny — założenie projektowe

Docelowo:
- klient korzysta z własnego Cloudflare,
- własnej D1,
- własnego Google Drive,
- własnego tokenu Loyverse.

---

## 21. Organizacja projektu

### Czat główny
`PWA — MASTER / ARCHITEKTURA`

### Czaty modułowe
- `01 — SPRZEDAŻ`
- `02 — DOSTAWY`
- `03 — KOSZTY`
- `04 — ANALIZY`
- `06 — USTAWIENIA`
- `07 — STRONA GŁÓWNA`
- `08 — INTEGRACJE / D1 / LOYVERSE`

`05 — RABATY` nie jest aktywnym modułem v1; temat wraca dopiero, gdy zdecydujemy o własnej obsłudze rabatów poza POS.

---

## 22. Wersjonowanie

Stosujemy wersjonowanie semantyczne, np.:
- `poleczka-pwa-v0.1.0`
- `poleczka-pwa-v0.2.0`
- `poleczka-pwa-v1.0.0`

---

## 23. Zasada aktualizacji MASTER

MASTER aktualizujemy, gdy:
- zmienia się architektura,
- model danych,
- zakres modułu,
- reguła biznesowa,
- standard UI,
- sposób synchronizacji,
- ustalenie obowiązujące więcej niż jeden moduł.

---

## 24. Aktualny priorytet

Pierwszym głównym modułem funkcjonalnym pozostaje **SPRZEDAŻ**.

---

## 25. Status

### Już ustalone
- architektura PWA + Worker + D1,
- Loyverse jako źródło danych,
- Google Drive dla dokumentów kosztowych,
- działalność nierejestrowana jako zakres v1,
- kwartalny limit działalności,
- wygląd głównych ekranów,
- model tabel sprzedaży, kosztów i dostaw,
- główne analizy,
- brak konfiguracji rabatów w PWA v1 — rabaty obsługuje POS/Loyverse.

---

## 26. Repozytorium jest źródłem prawdy

Repozytorium `022IE/poleczka-pwa` jest wspólnym źródłem prawdy dla kodu, konfiguracji, dokumentacji i workflow publikacji.

Gałęzie:
- `main` — wersja stabilna,
- `dev` — bieżące prace rozwojowe,
- `pipeline-status` — szybki status pracy widoczny w widżecie.

---

## 27. Obowiązkowy workflow każdej zmiany PWA

`AGENTS.md` obowiązuje każdy czat / agenta.

Przed pierwszą zmianą na `dev` pierwszy zapis musi trafić do:

`pipeline-status/status/work-status.json`

ze stanem:
- `state = editing`,
- etykieta **Wprowadzanie poprawek**,
- opis zadania,
- aktualny `updatedAt`.

Po zakończeniu własnej serii zmian:
- `state = awaiting_publish`,
- etykieta **Oczekiwanie na publikację**.

Nie wolno bez sprawdzenia nadpisywać aktywnego statusu innego czatu.

---

## 28. Widżet pipeline — zasady developerskie

Widżet pokazuje:

`Prace → GitHub → Build → Cloudflare → Online`

Build i Cloudflare są osobnymi etapami. `Online` jest zielone dopiero po potwierdzeniu aktualnego SHA na działającej PWA.

Widżet jest narzędziem developerskim i w wersji produkcyjnej ma być możliwy do wyłączenia konfiguracją.

---

## 29. Aktualny sposób pracy

Typowy cykl:

`polecenie użytkownika → Wprowadzanie poprawek → zmiany na dev → GitHub → Build → Cloudflare → Online → weryfikacja w PWA`

Użytkownik nie powinien pobierać i rozpakowywać plików, jeżeli zmiana może zostać wykonana bezpośrednio w repozytorium.

---

## 30. Pliki binarne i assety graficzne

Dla plików `PNG`, `JPG`, `WEBP` i innych binarnych assetów:
- zapis do GitHuba wykonujemy jako prawdziwy binarny Git blob,
- nie używamy do nich mechanizmu przeznaczonego dla zwykłych plików tekstowych,
- po zapisie weryfikujemy blob SHA i rozmiar,
- jeśli użytkownik przekazuje konkretną grafikę referencyjną, używamy dokładnie tej grafiki; nie rekonstruujemy jej samodzielnie bez wyraźnej prośby.

To jest obowiązujący standard projektu.