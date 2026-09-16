# Półeczka Iwonki — PWA

Repozytorium aplikacji PWA dla projektu **Półeczka Iwonki**.

## Założenia v0.1.0

- frontend: React + Vite + TypeScript,
- backend/API: Cloudflare Worker,
- baza: Cloudflare D1,
- źródło danych sprzedażowych: Loyverse API + webhook,
- dokumenty kosztowe: Google Drive użytkownika,
- zakres v1: działalność nierejestrowana.

## Organizacja projektu

```text
docs/         dokumentacja i specyfikacje modułów
src/          frontend PWA
worker/       Cloudflare Worker / API
migrations/   migracje D1
```

## Gałęzie

- `main` — wersja stabilna,
- `dev` — bieżące prace rozwojowe.

## Dokumentacja

- `docs/POLECZKA_PWA_MASTER.md` — główne źródło prawdy projektu,
- `docs/MODUL_SPRZEDAZ.md` — specyfikacja modułu sprzedaży,
- `docs/MODUL_USTAWIENIA.md` — specyfikacja ustawień.

Aktualny etap: fundament projektu v0.1.0 i przygotowanie modułu **SPRZEDAŻ**.
