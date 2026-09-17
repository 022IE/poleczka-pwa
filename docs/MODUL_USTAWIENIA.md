# PÓŁECZKA IWONKI — MODUŁ USTAWIENIA

**Moduł:** 06 — USTAWIENIA  
**Status:** specyfikacja wdrożeniowa v0.2  
**Dokument nadrzędny:** `POLECZKA_PWA_MASTER.md`  
**Aktualizacja:** 17.09.2026

---

## Terminologia — DNR

Od 17.09.2026 obowiązuje skrót:

**DNR = działalność nierejestrowana**.

Skrót `DNR` może być stosowany zamiennie z pełnym określeniem „działalność nierejestrowana” w dokumentacji, komunikacji projektowej i interfejsie tam, gdzie skrót poprawia czytelność.

---

# 1. Cel modułu

Moduł USTAWIENIA centralizuje konfigurację aplikacji PWA.

Użytkownik powinien móc tutaj:
- ustawić dane firmy / marki,
- skonfigurować działalność nierejestrowaną,
- ustawić limit kwartalny,
- zarządzać słownikami,
- skonfigurować integracje,
- ustawić wygląd i zachowanie aplikacji,
- sprawdzić stan połączeń,
- wykonać import / eksport ustawień.

## Rabaty — obowiązujące ustalenie

W v1 **nie ma konfiguracji rabatów w module USTAWIENIA**.

Rabaty pozostają obsługiwane tak jak dotychczas z poziomu **POS / Loyverse**.

PWA jedynie odczytuje informacje o rabatach zapisane przy sprzedaży i wykorzystuje je w prezentacji oraz analizach.

Nie wdrażamy tutaj:
- CRUD rabatów,
- aktywacji / dezaktywacji,
- kolejności rabatów,
- przypinania rabatów do kafelków,
- tabeli definicji rabatów jako ustawienia PWA.

---

# 2. Układ ekranu

Ekran ustawień dzielimy na sekcje / zakładki:

1. Firma
2. Działalność nierejestrowana
3. Kategorie
4. Artykuły
5. Dostawcy
6. Formy płatności
7. Integracje
8. Google Drive
9. Synchronizacja
10. Powiadomienia
11. Wygląd
12. Import / eksport
13. Informacje o aplikacji

Na desktopie:
- menu sekcji po lewej,
- formularz po prawej.

Na telefonie:
- sekcje jako lista rozwijana / akordeon.

---

# 3. Sekcja FIRMA

Pola:
- nazwa marki / firmy,
- nazwa wyświetlana w aplikacji,
- waluta,
- język,
- strefa czasowa,
- logo,
- domyślny widok po uruchomieniu.

Domyślne wartości:
- Marka: `Półeczka Iwonki`
- Waluta: `PLN`
- Język: `pl`
- Strefa czasowa: `Europe/Warsaw`

---

# 4. Typ działalności

W v1 aktywny typ:

`Działalność nierejestrowana`

Pole może być przygotowane przyszłościowo jako:
- Działalność nierejestrowana
- JDG — nieaktywne / przyszłość

Na tym etapie JDG nie wdrażamy funkcjonalnie.

---

# 5. Działalność nierejestrowana

Sekcja zawiera:
- obowiązujący limit kwartalny,
- rok,
- kwartał,
- próg ostrzegawczy 1,
- próg ostrzegawczy 2,
- próg ostrzegawczy 3,
- sposób liczenia wykorzystania limitu,
- widoczność kafelka limitu na stronie głównej.

Przykładowe progi:
- 70%
- 85%
- 95%
- 100%

Limit nie może być zaszyty na stałe w kodzie.

---

# 6. Kafelek limitu na stronie głównej

Ustawienia sterują tym, czy dashboard pokazuje:
- wykorzystaną kwotę,
- limit,
- % wykorzystania,
- pozostałą kwotę,
- numer / nazwę kwartału,
- komunikat ostrzegawczy.

---

# 7. Kategorie

Sekcja zarządzania kategoriami:
- lista kategorii,
- aktywne / nieaktywne,
- kolejność,
- nazwa,
- identyfikator źródłowy z Loyverse,
- data ostatniej synchronizacji.

Kategorie pochodzą głównie z Loyverse / D1.

Preferowane:
- dezaktywacja zamiast twardego usunięcia, jeśli rekord jest potrzebny do historii.

---

# 8. Artykuły

Sekcja artykułów pokazuje:
- nazwę,
- kategorię,
- SKU,
- status aktywny / nieaktywny,
- identyfikator item / variant,
- ostatnią synchronizację.

Podstawowym źródłem artykułów jest Loyverse / D1.

---

# 9. Dostawcy

Lista dostawców jest edytowalna.

Minimalne pola:
- nazwa,
- aktywny / nieaktywny,
- notatka,
- data utworzenia.

Obowiązujące historyczne przykłady:
- Iwonka
- MAT Fortuna Targowisko
- Talia Brzesko
- StockHurt Skawina

---

# 10. Formy płatności

Lista form płatności:
- pobierana z D1 / Loyverse,
- dostępna jako słownik,
- wykorzystywana w filtrach sprzedaży.

Widok pokazuje:
- nazwę,
- aktywna / nieaktywna,
- identyfikator źródłowy,
- ostatnią synchronizację.

---

# 11. Integracje

Sekcja integracji pokazuje kafelki:
- Loyverse
- Cloudflare D1
- Google Drive

Każdy kafelek pokazuje:
- status,
- nazwę połączenia,
- ostatni poprawny kontakt,
- przycisk testu,
- przycisk konfiguracji.

Statusy:
- Połączono
- Nie połączono
- Błąd
- Wymaga uwagi

---

# 12. Loyverse

Pola / funkcje:
- status tokenu,
- merchant / konto,
- test połączenia,
- ostatnia synchronizacja,
- webhook status,
- historia ostatnich błędów.

Token:
- nie jest wyświetlany w pełnej postaci po zapisaniu,
- jest przechowywany bezpiecznie poza frontendem.

Frontend nie może mieć trwałego, jawnego tokenu API.

---

# 13. Cloudflare D1

Aktualne środowisko developerskie korzysta z bazy:

`poleczka-dev`

Obowiązujące zasady:
- `poleczka-dev` jest bazą dla bieżących prac, testów, migracji i zapytań developerskich,
- nie kierujemy zmian developerskich do innej bazy bez wyraźnego ustalenia,
- interfejs ustawień powinien docelowo pokazywać rzeczywistą nazwę aktywnej bazy z konfiguracji środowiska.

Sekcja informacyjna:
- nazwa bazy,
- status połączenia,
- wersja schematu,
- liczba paragonów,
- liczba linii,
- ostatnia synchronizacja,
- stan migracji.

---

# 14. Google Drive

Google Drive służy do przechowywania dokumentów kosztowych.

Sekcja umożliwia:
- połączenie konta Google,
- rozłączenie,
- wybór folderu głównego,
- utworzenie automatycznej struktury folderów,
- test zapisu,
- pokazanie bieżącego folderu.

Przykładowa struktura:

`Półeczka Iwonki / Dokumenty kosztowe / 2026 / 09 /`

---

# 15. Dokumenty kosztowe

D1 przechowuje tylko:
- `cost_id`,
- `provider`,
- `file_id`,
- `filename`,
- `mime_type`,
- metadane.

Plik fizyczny:
- Google Drive.

Jeden koszt może mieć wiele dokumentów.

---

# 16. Synchronizacja

Ustawienia synchronizacji:
- automatyczna synchronizacja,
- ręczne odświeżenie,
- częstotliwość dodatkowych importów API,
- status webhooka,
- log ostatnich synchronizacji,
- alerty o błędach.

Na stronie ustawień widoczny:
- **Ostatnia poprawna synchronizacja**
- **Ostatni błąd**

---

# 17. Powiadomienia

Docelowo możliwe kanały:
- powiadomienia PWA,
- Telegram,
- e-mail.

Struktura ustawień:
- włącz / wyłącz,
- typ alertu,
- kanał.

Przykładowe alerty:
- błąd synchronizacji,
- nieznana dostawa,
- zbliżenie do limitu działalności nierejestrowanej,
- przekroczenie limitu.

---

# 18. Wygląd

Sekcja umożliwia:
- motyw jasny / systemowy,
- akcent kolorystyczny,
- gęstość tabel,
- wielkość kafelków,
- domyślny ekran startowy.

Styl bazowy v1:
- jasny,
- butikowy,
- premium,
- beż / złoto / czerń / delikatne pastele.

---

# 19. Branding

Użytkownik docelowo może zmienić:
- nazwę firmy,
- logo,
- krótką nazwę aplikacji,
- kolor akcentu.

Nie hardkodujemy „Półeczka Iwonki” jako jedynej możliwej marki produktu.

---

# 20. Import / eksport ustawień

Docelowo:
- eksport konfiguracji do JSON,
- import konfiguracji z JSON,
- kopia bezpieczeństwa ustawień,
- przywrócenie ustawień.

Nie eksportujemy wprost:
- tokenów,
- sekretów,
- poufnych danych dostępowych.

---

# 21. Dane konfiguracyjne — proponowane tabele

## `app_settings`
- key
- value
- type
- updated_at

## `suppliers`
- id
- name
- is_active
- note
- created_at
- updated_at

## `cost_documents`
- id
- cost_id
- provider
- file_id
- filename
- mime_type
- created_at

### Rabaty
W v1 **nie tworzymy tabeli `discounts` na potrzeby konfiguracji PWA**. Rabaty pozostają zarządzane w POS / Loyverse.

Jeżeli dane o użytym rabacie są potrzebne do historii i analiz, zachowujemy je jako część danych sprzedażowych synchronizowanych z POS.

---

# 22. Bezpieczeństwo

Sekrety:
- Loyverse token,
- Google OAuth credentials,
- Cloudflare secrets

nie mogą być przechowywane w localStorage w jawnej postaci.

Preferowane:
- Worker secrets,
- bezpieczne sesje,
- OAuth.

---

# 23. Walidacja

Każdy formularz powinien:
- walidować dane przed zapisem,
- pokazywać czytelny błąd,
- blokować niepoprawne wartości.

Przykłady:
- limit kwartalny: > 0,
- próg ostrzeżenia: 0–100.

Walidacja definicji rabatów nie należy do tego modułu, ponieważ rabaty nie są konfigurowane w PWA v1.

---

# 24. Zapisywanie ustawień

Po zmianie:
- użytkownik klika **Zapisz**,
- widzi komunikat sukcesu,
- aplikacja od razu odświeża zależne elementy.

Dla krytycznych zmian:
- dodatkowe potwierdzenie.

Przykłady:
- rozłączenie integracji,
- reset ustawień.

---

# 25. Responsywność

Desktop:
- menu ustawień z lewej,
- formularze po prawej.

Tablet:
- węższe menu lub zakładki.

Telefon:
- sekcje akordeonowe,
- pełna szerokość formularza,
- duże pola dotykowe.

---

# 26. Stany interfejsu

Muszą istnieć:
- ładowanie,
- zapis w toku,
- zapisano,
- błąd,
- brak połączenia,
- test połączenia zakończony sukcesem,
- test połączenia zakończony błędem.

---

# 27. Kryteria odbioru modułu

Moduł USTAWIENIA uznajemy za gotowy w v1, gdy:
- [ ] działa sekcja Firma,
- [ ] działa konfiguracja działalności nierejestrowanej,
- [ ] można ustawić limit kwartalny,
- [ ] działają progi ostrzegawcze,
- [ ] widoczne są kategorie,
- [ ] widoczne są artykuły,
- [ ] działa lista dostawców,
- [ ] widoczne są formy płatności,
- [ ] działa status Loyverse,
- [ ] działa status D1,
- [ ] działa konfiguracja Google Drive,
- [ ] działa test integracji,
- [ ] można ustawić podstawowe opcje wyglądu,
- [ ] ustawienia zapisują się w D1,
- [ ] sekrety nie są przechowywane jawnie w frontendzie.

**CRUD rabatów nie jest kryterium odbioru v1.**

---

# 28. Kolejność wdrażania

## Etap A — podstawy
1. Firma
2. działalność nierejestrowana
3. limit kwartalny

## Etap B — słowniki
1. dostawcy
2. kategorie
3. artykuły
4. formy płatności

## Etap C — integracje
1. Loyverse
2. D1
3. Google Drive
4. synchronizacja

## Etap D — wygląd i import / eksport

Rabaty nie wchodzą do harmonogramu modułu USTAWIENIA v1. Pozostają obsługiwane w POS / Loyverse.