# Półeczka Iwonki — PWA

Repozytorium aplikacji PWA dla projektu **Półeczka Iwonki**.

## Założenia v0.1.0

- frontend: React + Vite + TypeScript,
- backend/API: Cloudflare Worker,
- główna baza: Cloudflare D1 `poleczka-dev`,
- źródło danych sprzedażowych: Loyverse API + webhook,
- dokumenty kosztowe: Google Drive użytkownika,
- zakres v1: działalność nierejestrowana.

## Aktualny stan D1

Od 17.09.2026 aktywną i autorytatywną bazą PWA jest:

`poleczka-dev`

D1 database ID:

`099b4d9e-ad73-441b-a2be-a00f347a5905`

Live Worker `poleczka-loyverse-webhook` zapisuje dane Loyverse do `poleczka-dev`.

Aktywny Worker aplikacji PWA w Cloudflare to `poleczka-pwa`. Gałąź `dev` jest weryfikowana pod adresem `https://dev.poleczkaiwonki.dpdns.org`. Konfiguracja `wrangler.toml` ma wskazywać ten sam Worker; środowisko developerskie rozróżnia aktywna baza `poleczka-dev` i gałąź `dev`, a nie osobna nazwa Workera.

Poprzednia baza `poleczka-loyverse` (`4ababa0a-8912-49b0-9ee9-16ce771c27f3`) pozostaje jako archiwum po cutoverze i nie jest bieżącą bazą aplikacji.

Szczegółowy schemat, relacje i zasady dalszych migracji są zapisane w `docs/D1_STAN_AKTUALNY.md`.

## Organizacja projektu

```text
docs/         dokumentacja i specyfikacje modułów
src/          frontend PWA
worker/       Cloudflare Worker / API
migrations/   migracje D1
```

## Gałęzie

- `main` — wersja stabilna,
- `dev` — bieżące prace rozwojowe,
- `pipeline-status` — status pracy widoczny w widżecie developerskim.

## Dokumentacja

- `docs/POLECZKA_PWA_MASTER.md` — główne źródło prawdy projektu,
- `docs/D1_STAN_AKTUALNY.md` — obowiązujący stan aktywnej bazy D1, schemat i relacje,
- `docs/MODUL_SPRZEDAZ.md` — specyfikacja modułu sprzedaży,
- `docs/MODUL_DOSTAWY.md` — specyfikacja modułu dostaw i relacji z pozycjami sprzedaży,
- `docs/MODUL_ANALIZY.md` — specyfikacja modułu analiz,
- `docs/MODUL_USTAWIENIA.md` — specyfikacja ustawień,
- `docs/MODUL_VINTED.md` — specyfikacja modułu Vinted,
- `docs/WORKFLOW_PUBLIKACJI.md` — workflow publikacji PWA,
- `migrations/README.md` — zasady wersjonowania migracji D1.

Aktualny etap: rozwój PWA v0.1.0 na wspólnej bazie `poleczka-dev`, z aktywnym zasilaniem sprzedaży przez webhook Loyverse.
