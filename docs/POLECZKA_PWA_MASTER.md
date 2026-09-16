# PÓŁECZKA IWONKI — PWA MASTER

**Status:** dokument główny projektu  
**Rola:** jedno źródło prawdy dla całej aplikacji PWA  
**Aktualizacja bazowa:** 16.09.2026

---

## 1. Cel projektu

Celem jest stworzenie lekkiej, estetycznej i wygodnej aplikacji PWA dla małej sprzedaży prowadzonej w ramach działalności nierejestrowanej.

Pierwsza wersja PWA ma odtworzyć i rozwinąć funkcje, które obecnie działają w arkuszu LibreOffice, ale w formie znacznie wygodniejszej w obsłudze, bardziej atrakcyjnej wizualnie i bez ograniczeń typowych dla arkusza.

Na tym etapie **nie budujemy pełnego systemu dla JDG, VAT ani pełnej księgowości**. To będzie osobny etap w przyszłości.

---

## 2. Zakres wersji 1

W wersji 1 aplikacja obejmuje:

- stronę główną / dashboard,
- sprzedaż,
- dostawy,
- koszty,
- rabaty,
- artykuły,
- kategorie,
- analizy,
- synchronizację,
- ustawienia,
- kontrolę limitu działalności nierejestrowanej,
- przechowywanie dokumentów kosztowych poza D1.

---

## 3. Architektura

### Frontend
- PWA,
- docelowo React + Vite,
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

### Docelowy przepływ danych

`Loyverse -> Webhook / API -> Cloudflare Worker -> D1 -> PWA`

Dokumenty kosztowe:

`PWA -> Google Drive użytkownika`

D1 przechowuje tylko identyfikator pliku i metadane.

---

## 4. Zasady ogólne

- D1 jest głównym trwałym źródłem danych.
- PWA jest warstwą prezentacji i obsługi.
- Nie przechowujemy zdjęć ani PDF-ów dokumentów kosztowych w D1.
- Każdy klient docelowo korzysta z własnego konta Cloudflare, własnej D1 i własnego Google Drive.
- Tokeny API i dane dostępowe powinien wprowadzać sam użytkownik.
- Krytyczne reguły biznesowe nie mogą być rozproszone wyłącznie po czatach — mają trafiać do tego dokumentu lub do specyfikacji modułów.

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

W aplikacji nazwa i branding muszą być możliwe do zmiany w konfiguracji.

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
Na stronie głównej widoczny jest specjalny panel:

**Limit działalności nierejestrowanej**

Pokazuje:
- bieżący kwartał,
- kwotę wykorzystaną,
- obowiązujący limit,
- procent wykorzystania,
- kwotę pozostałą,
- pasek postępu,
- ostrzeżenia po przekroczeniu ustalonych progów.

Limit:
- jest kwartalny,
- nie może być na stałe wpisany w kod,
- musi być konfigurowalny.

### Wykresy na dashboardzie
- sprzedaż w czasie,
- porównanie tygodni,
- sprzedaż wg kategorii,
- heatmapa dzień tygodnia x godzina.

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

### Filtry
- zakres dat,
- forma płatności,
- kategoria,
- artykuł,
- wyszukiwarka.

### Tabela paragonów
Każdy paragon ma być jednym głównym wierszem.

Kolumny:
- numer paragonu,
- data,
- liczba pozycji,
- liczba sztuk,
- brutto,
- rabat,
- netto,
- płatność.

Przed paragonem ikona:

`+`

Po kliknięciu paragon rozwija swoje pozycje.

### Rozwinięte pozycje paragonu
Kolumny:
- artykuł,
- kategoria,
- SKU,
- ilość,
- cena,
- rabat,
- netto,
- Lp. dostawy.

### Zebra
Zebra jest osobna dla:
- paragonów,
- pozycji wewnątrz rozwiniętego paragonu.

Nie stosujemy zebry mieszanej między paragonem i jego pozycjami.

---

## 8. Reguły sprzedaży i dostaw

Pole Loyverse:

`line_note / komentarz`

jest numerem Lp. dostawy.

Reguły:
- `0` = dostawa wewnętrzna,
- pusty komentarz = `-1` niezidentyfikowana,
- numer dostawy nieistniejący aktualnie w tabeli dostaw = tymczasowo `-1`,
- przy kolejnej synchronizacji, jeżeli dana dostawa już istnieje, pozycja ma zostać ponownie przypisana prawidłowo.

Nieznana dostawa ma być zawsze bezpiecznie sprowadzona do `-1`.

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
Kolumny:
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

### Rozwijanie dostawy
Po kliknięciu `+` rozwijane są szczegóły:
- artykuł,
- kategoria,
- ilość,
- cena/szt.,
- sprzedane,
- sprzedaż,
- SKU / zakres SKU.

### Analizy dostaw
Planowane:
- sprzedaż wg dostawcy,
- rentowność dostaw,
- krzywa % zbytu dostaw w czasie,
- wykres punktowy: % zbytu vs zysk,
- Pareto 80/20 dla dostaw i dostawców.

---

## 10. Moduł KOSZTY

### Górne wskaźniki
- koszty dziś,
- koszty w kwartale,
- liczba dokumentów,
- średni koszt,
- największa kategoria kosztowa,
- udział kosztów w przychodzie.

### Filtry
- zakres dat,
- kategoria kosztu,
- forma płatności,
- dostawca,
- wyszukiwarka.

### Tabela kosztów
Każdy dokument kosztowy jest jednym głównym rekordem.

Kolumny:
- dokument,
- data,
- liczba pozycji,
- dostawca,
- brutto,
- forma płatności,
- kategoria główna.

Po rozwinięciu:
- pozycje dokumentu,
- załączniki.

### Pozycje kosztu
- pozycja,
- kategoria,
- ilość,
- cena,
- wartość,
- opis.

### Dokumenty kosztowe
Każdy koszt może mieć:
- jeden dokument,
- wiele dokumentów.

Obsługiwane przykłady:
- zdjęcie paragonu,
- PDF faktury,
- potwierdzenie przelewu,
- inny załącznik.

Opcje:
- Zrób zdjęcie,
- Dodaj z plików,
- Dodaj z Google Drive,
- podgląd załącznika.

### Przechowywanie
Pliki:
- Google Drive użytkownika.

D1:
- `cost_id`,
- `provider`,
- `file_id`,
- `filename`,
- `mime_type`,
- pozostałe metadane.

Docelowo osobna tabela:

`cost_documents`

dla relacji wiele załączników -> jeden koszt.

---

## 11. Moduł RABATY

Rabaty mają własną tabelę definicji.

Minimalne pola:
- nazwa,
- wartość,
- typ.

Typ:
- procent,
- kwota.

Przykłady:
- Stały klient | 10 | procent
- Wyprzedaż | 20 | procent
- Promocja | 10 | kwota

### Zastosowanie rabatu
Ten sam rabat może być użyty:
- na pozycję,
- na cały paragon.

Zakres nie musi być elementem definicji rabatu.

Zakres wynika z miejsca zastosowania.

### POS / ekran wyboru
Rabaty można przypinać do kafelków na ekranie POS podobnie jak artykuły.

Kliknięcie kafelka rabatu:
- stosuje zdefiniowany rabat do całego paragonu.

Podczas edycji ceny konkretnej pozycji:
- rabat można zastosować tylko do tej pozycji.

### Historia użycia rabatów
D1 powinno umożliwiać analizę:
- jaki rabat został użyty,
- wartość,
- typ,
- zakres,
- kwota przed rabatem,
- kwota po rabacie.

---

## 12. Moduł ANALIZY

### Filtry wspólne
Gdzie ma to sens:
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

### Porównanie wielu okresów
Kluczowa analiza.

Pola sterujące:
- długość okresu,
- jednostka,
- liczba okresów.

Przykład:

`7 | dni | 10 okresów`

Efekt:
- jeden wykres,
- 10 linii,
- każda linia = osobny 7-dniowy okres,
- oś X = dzień 1..7 lub poniedziałek..niedziela,
- najnowszy okres wyróżniony.

Cel:
- ocena powtarzalności,
- ocena rozrzutu,
- identyfikacja dni mocnych i słabych,
- obserwacja trendu między okresami.

### Heatmapa
Dzień tygodnia x godzina.

Cel:
- wskazanie godzin i dni o największej sprzedaży.

### Histogram cen
Cel:
- pokazanie przedziałów cenowych, w których sprzedaje się najwięcej,
- analiza liczby sztuk i wartości sprzedaży.

### Dostawy
- krzywa zbytu w czasie,
- rentowność,
- Pareto 80/20.

---

## 13. Moduł USTAWIENIA

### Firma
Pola:
- nazwa firmy / marki,
- tryb firmy,
- waluta,
- strefa czasowa,
- język.

Na tym etapie obowiązuje:

`Działalność nierejestrowana`

JDG pozostaje poza zakresem v1.

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

Widoczny status:
- połączono / nie połączono.

Opcje:
- synchronizacja automatyczna,
- powiadomienia.

### Rabaty
CRUD:
- dodaj,
- edytuj,
- usuń.

### Słowniki
- Kategorie,
- Artykuły,
- Dostawcy,
- Formy płatności.

### Wygląd
- motyw,
- widok startowy,
- układ menu bocznego,
- wersja aplikacji.

### Import / eksport ustawień
Docelowo:
- eksport ustawień,
- import ustawień,
- kopia ustawień.

---

## 14. Synchronizacja

Obecny model synchronizacji:

`Loyverse -> D1 -> aplikacja`

Należy zachować:
- webhooki,
- import historii,
- automatyczną synchronizację,
- status ostatniej synchronizacji,
- komunikaty o błędach.

Na stronie aplikacji użytkownik powinien widzieć:
- status synchronizacji,
- czas ostatniego poprawnego pobrania,
- ewentualny błąd.

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

Listy filtrów zawsze mają opcję:

`Wszystkie`

---

## 18. Działalność nierejestrowana

W v1 aplikacja jest projektowana przede wszystkim dla działalności nierejestrowanej.

Obowiązuje:
- kontrola kwartalnego limitu,
- możliwość konfiguracji limitu,
- panel wykorzystania limitu na stronie głównej,
- ostrzeżenia progowe.

Nie projektujemy jeszcze:
- pełnej obsługi JDG,
- pełnego VAT,
- pełnej księgowości,
- rozbudowanej obsługi faktur VAT,
- automatycznego składania PIT.

Te elementy mogą powstać w kolejnych etapach.

---

## 19. Potencjalny przyszły zakres — NIE v1

Do późniejszego rozważenia:

- pełny własny POS,
- odejście od Loyverse,
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

Aplikacja ma być projektowana tak, aby w przyszłości mogła być sprzedawana.

Założenia:
- klient korzysta z własnego Cloudflare,
- klient korzysta z własnej D1,
- klient korzysta z własnego Google Drive,
- klient podaje własny token Loyverse,
- aplikacja nie musi centralnie przechowywać danych wielu klientów.

Korzyści:
- niższy koszt infrastruktury,
- mniejsze ryzyko RODO,
- łatwiejsze skalowanie,
- brak konieczności utrzymywania dużego centralnego magazynu dokumentów.

---

## 21. Organizacja projektu

### Czat główny
`PWA — MASTER / ARCHITEKTURA`

Służy do:
- decyzji wspólnych,
- modelu danych,
- integracji,
- standardów,
- kolejności prac.

### Czaty modułowe
Proponowany podział:

- `01 — SPRZEDAŻ`
- `02 — DOSTAWY`
- `03 — KOSZTY`
- `04 — ANALIZY`
- `05 — RABATY`
- `06 — USTAWIENIA`
- `07 — STRONA GŁÓWNA`
- `08 — INTEGRACJE / D1 / LOYVERSE`

Każdy moduł powinien mieć własny plik specyfikacji, np.:

`MODUL_SPRZEDAZ.md`

---

## 22. Wersjonowanie

Nie używamy nazw typu:
- final,
- final2,
- poprawiony_final.

Docelowo:

`poleczka-pwa-v0.1.0`  
`poleczka-pwa-v0.2.0`  
`poleczka-pwa-v1.0.0`

MASTER powinien zawsze wskazywać aktualną bazę projektu.

---

## 23. Zasada aktualizacji MASTER

MASTER aktualizujemy, gdy:
- zmienia się architektura,
- zmienia się model danych,
- dochodzi nowy moduł,
- zmienia się reguła biznesowa,
- zmienia się obowiązujący standard UI,
- zmienia się sposób synchronizacji,
- ustalamy coś, co ma obowiązywać więcej niż jeden moduł.

Szczegóły lokalne trafiają do dokumentu danego modułu.

---

## 24. Aktualny priorytet

Pierwszy moduł do realnego wykonania:

**SPRZEDAŻ**

Kolejność:
1. utworzenie specyfikacji modułu,
2. zaprojektowanie danych i endpointów,
3. budowa widoku,
4. integracja z D1,
5. filtry,
6. rozwijanie paragonów,
7. testy,
8. dopiero potem przejście do kolejnego modułu.

---

## 25. Status

### Już ustalone
- architektura PWA + Worker + D1,
- Loyverse jako źródło danych,
- Google Drive dla dokumentów kosztowych,
- działalność nierejestrowana jako zakres v1,
- kwartalny limit działalności,
- wygląd głównych ekranów,
- model tabeli sprzedaży,
- model tabeli kosztów,
- model tabeli dostaw,
- model rabatów,
- główne analizy,
- podział projektu na moduły.

### Następny krok
Utworzyć:

`MODUL_SPRZEDAZ.md`

i rozpocząć realną implementację modułu sprzedaży.

---

## 26. Repozytorium jest źródłem prawdy

Od 16.09.2026 obowiązuje praca bez ręcznego przekazywania ZIP-ów i rozpakowywania paczek.

Repozytorium:

`022IE/poleczka-pwa`

jest wspólnym źródłem prawdy dla kodu, konfiguracji, dokumentacji i workflow publikacji.

Obowiązujące gałęzie:
- `main` — wersja stabilna,
- `dev` — bieżące prace rozwojowe,
- `pipeline-status` — wyłącznie szybki status pracy widoczny w widżecie; zmiany tej gałęzi nie mogą uruchamiać zwykłego builda PWA.

Nie tworzymy równoległych lokalnych „finalnych” paczek jako podstawowego sposobu pracy.

---

## 27. Obowiązkowy workflow każdej zmiany PWA

Plik `AGENTS.md` w głównym katalogu repozytorium jest instrukcją obowiązującą każdy czat / agenta pracującego na tym repo.

### Przed pierwszą zmianą kodu

Pierwszy zapis musi dotyczyć:

`pipeline-status/status/work-status.json`

i ustawić:

- `state = editing`,
- etykietę **Wprowadzanie poprawek**,
- krótki opis aktualnego zadania,
- aktualny czas `updatedAt`.

**Dopiero po zgłoszeniu statusu wolno modyfikować `dev`.**

Dzięki temu użytkownik widzi rozpoczęcie pracy jeszcze przed pierwszym commitem kodu.

### Po zakończeniu własnej serii zmian

Status przechodzi na:

- `state = awaiting_publish`,
- etykietę **Oczekiwanie na publikację**.

Dalsze etapy są aktualizowane automatycznie.

### Prace równoległe w kilku czatach

Nie wolno bezmyślnie kasować aktywnego statusu innego czatu. Jeżeli kilka czatów pracuje równolegle, opis `task` powinien uwzględniać aktywne prace albo pozostać w stanie `editing`, dopóki faktycznie trwa co najmniej jedno zadanie.

System nie może wykryć samego „myślenia” innego czatu przed wykonaniem przez niego pierwszego zapisu — dlatego zgłoszenie `editing` jest obowiązkowym pierwszym krokiem każdego agenta.

---

## 28. Widżet pipeline — zasady developerskie

Na czas budowy PWA w górnym panelu znajduje się developerski widżet publikacji.

Położenie:
- środek górnego panelu,
- pomiędzy **„Dzień dobry, Iwonko!”** a blokiem kalendarza / ikon.

Rozmiar obecnie uznajemy za właściwy.

Widżet pokazuje pełną ścieżkę:

`Prace → GitHub → Build → Cloudflare → Online`

### Znaczenie etapów

- **Prace** — agent wprowadza poprawki; źródłem jest `pipeline-status`.
- **GitHub** — commit został wysłany do `dev`.
- **Build** — rzeczywista kompilacja GitHub Actions.
- **Cloudflare** — osobny etap oczekiwania na wdrożenie.
- **Online** — aktualny commit jest faktycznie dostępny w działającej PWA.

**Build i Cloudflare są rozdzielone.** Build nie może pozostawać w stanie „trwa” tylko dlatego, że wdrożenie Cloudflare jeszcze się nie zakończyło.

`Online` może być zielone tylko wtedy, gdy najnowszy commit / SHA został potwierdzony jako wdrożony. Działanie poprzedniej wersji aplikacji nie oznacza sukcesu nowej publikacji.

### Aktualizacja statusów

Podstawowy mechanizm:
- Cloudflare Durable Object,
- WebSocket,
- aktualizacje push do otwartej PWA.

Fallback:
- HTTP tylko po utracie połączenia WebSocket,
- automatyczny reconnect,
- widoczny stan połączenia: `LIVE`, `ŁĄCZENIE`, `AWARYJNY`, `BRAK POŁ.`.

Snapshot statusu nie może bezterminowo przechowywać starego stanu. Po ponownym połączeniu / ręcznym odświeżeniu należy uzgodnić go z rzeczywistym stanem GitHub Actions i aktualnie wdrożonym SHA.

### Wersja finalna

Widżet jest narzędziem developerskim. W finalnej wersji produkcyjnej ma być wyłączony przełącznikiem konfiguracyjnym, bez konieczności usuwania mechanizmu diagnostycznego z kodu.

---

## 29. Aktualny sposób pracy

Od teraz typowy cykl wygląda następująco:

`polecenie użytkownika → Wprowadzanie poprawek → zmiany na dev → GitHub → Build → Cloudflare → Online → weryfikacja w PWA`

Użytkownik nie powinien pobierać i rozpakowywać plików, jeżeli zmiana może zostać wykonana bezpośrednio w repozytorium.

Dokumenty `POLECZKA_PWA_MASTER.md` i pliki `MODUL_*.md` mają być aktualizowane razem z decyzjami projektowymi, żeby nowe czaty nie musiały odtwarzać ustaleń z historii rozmów.

Sekcje 26–29 są nowsze i w razie konfliktu zastępują starsze informacje organizacyjne w tym dokumencie.
