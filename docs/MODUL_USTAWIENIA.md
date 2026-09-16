# PÓŁECZKA IWONKI — MODUŁ USTAWIENIA

**Moduł:** 06 — USTAWIENIA  
**Status:** specyfikacja wdrożeniowa v0.1  
**Dokument nadrzędny:** `POLECZKA_PWA_MASTER.md`  
**Aktualizacja:** 16.09.2026

---

# 1. Cel modułu

Moduł USTAWIENIA ma centralizować całą konfigurację aplikacji PWA.

Użytkownik powinien móc tutaj:

- ustawić dane firmy / marki,
- skonfigurować działalność nierejestrowaną,
- ustawić limit kwartalny,
- zarządzać rabatami,
- zarządzać słownikami,
- skonfigurować integracje,
- ustawić wygląd i zachowanie aplikacji,
- sprawdzić stan połączeń,
- wykonać import / eksport ustawień.

Wersja 1 jest projektowana przede wszystkim dla **działalności nierejestrowanej**.

---

# 2. Układ ekranu

Ekran ustawień dzielimy na sekcje / zakładki:

1. Firma
2. Działalność nierejestrowana
3. Rabaty
4. Kategorie
5. Artykuły
6. Dostawcy
7. Formy płatności
8. Integracje
9. Google Drive
10. Synchronizacja
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

Domyślne wartości dla projektu:

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

Sekcja powinna zawierać:

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

Ustawienia powinny sterować tym, czy na dashboardzie pokazywane są:

- wykorzystana kwota,
- limit,
- % wykorzystania,
- pozostała kwota,
- numer / nazwa kwartału,
- komunikat ostrzegawczy.

Przykład:

**III kwartał 2026**  
`7 850,00 zł / 10 813,50 zł`  
`72,6%`

---

# 7. Moduł RABATY w ustawieniach

Rabaty mają własną tabelę definicji.

Minimalne pola:

- Nazwa
- Wartość
- Typ

Typ:

- procent
- kwota

Przykłady:

| Nazwa | Wartość | Typ |
|---|---:|---|
| Stały klient | 10 | procent |
| Wyprzedaż | 20 | procent |
| Promocja | 10 | kwota |

Operacje:

- dodaj,
- edytuj,
- usuń,
- aktywuj / dezaktywuj,
- ustaw kolejność.

---

# 8. Zastosowanie rabatów

Definicja rabatu nie zawiera pola „pozycja / paragon”.

Ten sam rabat może być zastosowany:

- na pojedynczą pozycję,
- na cały paragon.

Zakres wynika z miejsca użycia rabatu.

W przyszłym POS:
- rabaty można przypinać do kafelków,
- kliknięcie kafelka rabatu stosuje go do paragonu,
- przy edycji pozycji rabat może być zastosowany do pozycji.

---

# 9. Kategorie

Sekcja zarządzania kategoriami:

- lista kategorii,
- aktywne / nieaktywne,
- kolejność,
- nazwa,
- identyfikator źródłowy z Loyverse,
- data ostatniej synchronizacji.

Kategorie pochodzą głównie z Loyverse / D1.

Użytkownik nie powinien przypadkowo usuwać kategorii potrzebnej do historii.

Preferowane:
- dezaktywacja zamiast twardego usunięcia.

---

# 10. Artykuły

Sekcja artykułów powinna pokazywać:

- nazwę,
- kategorię,
- SKU,
- status aktywny / nieaktywny,
- identyfikator item / variant,
- ostatnią synchronizację.

Podstawowym źródłem artykułów jest Loyverse / D1.

---

# 11. Dostawcy

Lista dostawców powinna być edytowalna.

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

Lista ma być konfigurowalna.

---

# 12. Formy płatności

Lista form płatności:

- pobierana z D1 / Loyverse,
- dostępna jako słownik,
- wykorzystywana w filtrach sprzedaży.

Widok powinien pokazywać:

- nazwa,
- aktywna / nieaktywna,
- identyfikator źródłowy,
- ostatnia synchronizacja.

---

# 13. Integracje

Sekcja integracji pokazuje kafelki:

- Loyverse
- Cloudflare D1
- Google Drive

Każdy kafelek powinien pokazywać:

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

# 14. Loyverse

Pola / funkcje:

- status tokenu,
- merchant / konto,
- test połączenia,
- ostatnia synchronizacja,
- webhook status,
- historia ostatnich błędów.

Token:
- nie powinien być wyświetlany w pełnej postaci po zapisaniu,
- powinien być przechowywany bezpiecznie poza frontendem.

Frontend nie może mieć trwałego, jawnego tokenu API.

---

# 15. Cloudflare D1

Sekcja informacyjna:

- nazwa bazy,
- status połączenia,
- wersja schematu,
- liczba paragonów,
- liczba linii,
- ostatnia synchronizacja,
- stan migracji.

Nie pokazujemy użytkownikowi surowych danych dostępowych, jeśli nie są potrzebne.

---

# 16. Google Drive

Google Drive służy do przechowywania dokumentów kosztowych.

Sekcja powinna umożliwiać:

- połączenie konta Google,
- rozłączenie,
- wybór folderu głównego,
- utworzenie automatycznej struktury folderów,
- test zapisu,
- pokazanie bieżącego folderu.

Przykładowa struktura:

`Półeczka Iwonki / Dokumenty kosztowe / 2026 / 09 /`

---

# 17. Dokumenty kosztowe

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

# 18. Synchronizacja

Ustawienia synchronizacji:

- automatyczna synchronizacja,
- ręczne odświeżenie,
- częstotliwość dodatkowych importów API,
- status webhooka,
- log ostatnich synchronizacji,
- alerty o błędach.

Na stronie ustawień widoczny:

**Ostatnia poprawna synchronizacja**

oraz:

**Ostatni błąd**

---

# 19. Powiadomienia

Docelowo możliwe kanały:

- powiadomienia PWA,
- Telegram,
- e-mail.

Na tym etapie należy przygotować strukturę ustawień:

- włącz / wyłącz,
- typ alertu,
- kanał.

Przykładowe alerty:

- błąd synchronizacji,
- nieznana dostawa,
- zbliżenie do limitu działalności nierejestrowanej,
- przekroczenie limitu.

---

# 20. Wygląd

Sekcja powinna umożliwiać:

- motyw jasny / systemowy,
- akcent kolorystyczny,
- gęstość tabel,
- wielkość kafelków,
- domyślny ekran startowy.

W v1 styl bazowy:

- jasny,
- butikowy,
- premium,
- beż / złoto / czerń / delikatne pastele.

---

# 21. Branding

Użytkownik docelowo powinien móc zmienić:

- nazwę firmy,
- logo,
- krótką nazwę aplikacji,
- ewentualnie kolor akcentu.

Nie hardkodujemy „Półeczka Iwonki” jako jedynej możliwej marki produktu.

---

# 22. Import / eksport ustawień

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

# 23. Dane konfiguracyjne — proponowane tabele

## `app_settings`

Przykładowe pola:

- key
- value
- type
- updated_at

## `discounts`

- id
- name
- value
- type
- is_active
- sort_order
- created_at
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

---

# 24. Bezpieczeństwo

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

# 25. Walidacja

Każdy formularz powinien:

- walidować dane przed zapisem,
- pokazywać czytelny błąd,
- blokować niepoprawne wartości.

Przykłady:

- procent rabatu: 0–100,
- kwotowy rabat: >= 0,
- limit kwartalny: > 0,
- próg ostrzeżenia: 0–100.

---

# 26. Zapisywanie ustawień

Po zmianie:

- użytkownik klika **Zapisz**,
- widzi komunikat sukcesu,
- aplikacja od razu odświeża zależne elementy.

Dla krytycznych zmian:

- dodatkowe potwierdzenie.

Przykład:
- rozłączenie integracji,
- usunięcie rabatu,
- reset ustawień.

---

# 27. Responsywność

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

# 28. Stany interfejsu

Muszą istnieć:

- ładowanie,
- zapis w toku,
- zapisano,
- błąd,
- brak połączenia,
- test połączenia zakończony sukcesem,
- test połączenia zakończony błędem.

---

# 29. Kryteria odbioru modułu

Moduł USTAWIENIA uznajemy za gotowy w v1, gdy:

- [ ] działa sekcja Firma,
- [ ] działa konfiguracja działalności nierejestrowanej,
- [ ] można ustawić limit kwartalny,
- [ ] działają progi ostrzegawcze,
- [ ] działa CRUD rabatów,
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
- [ ] sekrety nie są przechowywane jawnie w frontendzie,
- [ ] ekran działa na desktopie, tablecie i telefonie.

---

# 30. Zakres v1 — czego NIE robimy

Nie wdrażamy jeszcze:

- pełnej konfiguracji JDG,
- VAT,
- księgowości,
- numeracji faktur,
- podatków,
- pełnej obsługi wielu firm,
- rozbudowanych ról użytkowników,
- centralnego panelu SaaS.

---

# 31. Proponowana struktura frontendu

```text
src/
  modules/
    settings/
      pages/
        SettingsPage.tsx
      components/
        SettingsNav.tsx
        CompanySettings.tsx
        UnregisteredBusinessSettings.tsx
        DiscountsSettings.tsx
        CategoriesSettings.tsx
        ItemsSettings.tsx
        SuppliersSettings.tsx
        PaymentTypesSettings.tsx
        IntegrationsSettings.tsx
        GoogleDriveSettings.tsx
        SyncSettings.tsx
        AppearanceSettings.tsx
        BackupSettings.tsx
      api/
        settingsApi.ts
      hooks/
        useSettings.ts
      types/
        settings.ts
```

---

# 32. Proponowane endpointy

## Ustawienia ogólne

`GET /api/settings`

`PUT /api/settings`

## Rabaty

`GET /api/settings/discounts`

`POST /api/settings/discounts`

`PUT /api/settings/discounts/:id`

`DELETE /api/settings/discounts/:id`

## Dostawcy

`GET /api/settings/suppliers`

`POST /api/settings/suppliers`

`PUT /api/settings/suppliers/:id`

## Integracje

`GET /api/settings/integrations`

`POST /api/settings/integrations/loyverse/test`

`POST /api/settings/integrations/drive/test`

`POST /api/settings/integrations/d1/test`

---

# 33. Kolejność implementacji

## Etap A — ustawienia bazowe
1. Firma
2. działalność nierejestrowana
3. limit kwartalny

## Etap B — słowniki
1. rabaty
2. dostawcy
3. kategorie
4. artykuły
5. formy płatności

## Etap C — integracje
1. Loyverse
2. D1
3. Google Drive
4. synchronizacja

## Etap D — wygląd i backup
1. motyw
2. branding
3. eksport / import konfiguracji

---

# 34. Następny krok techniczny

Przed implementacją modułu należy:

1. zatwierdzić schemat `app_settings`,
2. zatwierdzić schemat `discounts`,
3. zatwierdzić schemat `suppliers`,
4. ustalić sposób bezpiecznego zapisu integracji,
5. przygotować endpoint `GET /api/settings`,
6. przygotować ekran sekcji Firma + działalność nierejestrowana.
