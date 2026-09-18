# PÓŁECZKA IWONKI — WORKFLOW ZMIAN I PUBLIKACJI

**Status:** obowiązująca zasada pracy
**Data ustalenia:** 16.09.2026

## Zasada nadrzędna

Każda zmiana wykonywana w PWA ma zostać najpierw zgłoszona do widżetu statusu, zanim rozpocznie się jakakolwiek inna praca nad kodem.

## Obowiązująca kolejność

1. **Prace — Wprowadzanie poprawek**
   - przed pierwszą zmianą kodu aktualizowany jest `status/work-status.json`,
   - widżet pokazuje nazwę aktualnie wykonywanego zadania,
   - użytkownik od razu widzi, że prace zostały rozpoczęte.

2. **GitHub — Zmiana wysłana**
   - właściwe zmiany kodu trafiają na gałąź `dev`.

3. **Build — Build trwa / Build gotowy / Build nieudany**
   - GitHub Actions automatycznie sprawdza projekt.

4. **Cloudflare — Oczekuje / Wdrażanie / Wdrożono**
   - po poprawnym buildzie śledzony jest etap publikacji.

5. **Online — Poprzednia wersja online / Najnowsza wersja online**
   - zakończenie następuje dopiero wtedy, gdy właściwa wersja jest dostępna online.

## Status po zakończeniu edycji

Po zapisaniu właściwych zmian kodu `status/work-status.json` jest ustawiany na:

`awaiting_publish`

Widżet pokazuje wtedy:

**Oczekiwanie na publikację**

Dalsze etapy wynikają już z rzeczywistego stanu builda i wdrożenia.

## Ważne

Zmiany wyłącznie w katalogu `status/` nie uruchamiają nowego builda. Dzięki temu status pracy może być aktualizowany natychmiast i niezależnie od procesu publikacji.

## Ścieżka widoczna w widżecie

`Prace → GitHub → Build → Cloudflare → Online`

Ta zasada obowiązuje dla wszystkich kolejnych zmian w projekcie PWA.
