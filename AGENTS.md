# Półeczka Iwonki — obowiązkowy workflow pracy z repozytorium

Ten plik obowiązuje każdy czat / agenta / narzędzie wykonujące zmiany w repozytorium `022IE/poleczka-pwa`.

## Zasada nadrzędna — status PRZED kodem

**Przed pierwszą zmianą w kodzie, CSS, konfiguracji, workflow, dokumentacji wdrożeniowej lub innych plikach PWA należy najpierw zgłosić rozpoczęcie pracy do widżetu statusu.**

Pierwsza operacja zapisu ma być wykonana na gałęzi `pipeline-status` w pliku:

`status/work-status.json`

Stan rozpoczęcia pracy:

```json
{
  "state": "editing",
  "label": "Wprowadzanie poprawek",
  "task": "Krótki opis aktualnego zadania",
  "updatedAt": "<aktualny czas ISO-8601>"
}
```

Dopiero po tym wolno zapisywać zmiany na `dev`.

## Po wysłaniu zmian do `dev`

Po zakończeniu własnej serii zmian należy ustawić na `pipeline-status`:

```json
{
  "state": "awaiting_publish",
  "label": "Oczekiwanie na publikację",
  "task": "Krótki opis zakończonych zmian",
  "updatedAt": "<aktualny czas ISO-8601>"
}
```

Dalsze etapy (`GitHub`, `Build`, `Cloudflare`, `Online`) aktualizują się automatycznie przez workflow / Worker / WebSocket.

## Ważne

- Nie pomijaj zgłoszenia statusu nawet przy zmianie jednego pliku lub jednej linijki.
- Nie czekaj ze statusem do pierwszego commita na `dev` — wtedy użytkownik nie widzi fazy „Wprowadzanie poprawek”.
- Zmiany `status/**` są odseparowane od zwykłego builda aplikacji.
- `main` pozostaje gałęzią stabilną; bieżące prace wykonujemy na `dev`.
- Przy pracy równoległej w kilku czatach ostatni aktywny czat aktualizuje opis `task`; nie należy kasować statusu aktywnej pracy innego czatu bez upewnienia się, że jego prace się zakończyły.

## Cel

Widżet w PWA ma odzwierciedlać pełną ścieżkę:

`Prace → GitHub → Build → Cloudflare → Online`

Etap **Prace** jest sygnałem pochodzącym od agenta, dlatego jego aktualizacja musi nastąpić przed pierwszą modyfikacją repozytorium.
