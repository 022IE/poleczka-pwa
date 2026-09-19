# PÓŁECZKA IWONKI — MODUŁ ANALIZY

**Moduł:** 07 — ANALIZY  
**Status:** specyfikacja bieżąca v0.4  
**Dokument nadrzędny:** `POLECZKA_PWA_MASTER.md`  
**Aktualizacja:** 19.09.2026

---

# 1. Cel modułu

Moduł ANALIZY ma prezentować dane sprzedażowe i dostawowe w formie czytelnych wykresów oraz porównań okresów.

Dane do analiz pochodzą z D1, a nie z lokalnie liczonych pełnych zestawów danych w przeglądarce.

Rabaty są wyłącznie danymi odczytywanymi z POS / Loyverse. PWA nie konfiguruje definicji rabatów.

---

# 2. Analizy podstawowe

Zakładamy m.in.:

- sprzedaż brutto,
- rabaty,
- sprzedaż netto,
- zysk,
- sprzedaż w czasie,
- sprzedaż według kategorii,
- heatmapę dzień tygodnia × godzina,
- histogram cen,
- analizy dostaw i dostawców.

---

# 3. Porównanie okresów — obowiązujące założenie

Wykres wcześniej określany jako **„Porównanie tygodni”** traktujemy od teraz jako **„Porównanie okresów”**.

Użytkownik wybiera trzy parametry:

1. **Datę końcową** — dzień, na którym kończy się najnowszy porównywany okres.
2. **Liczbę okresów** — od `1` do `5`.
3. **Typ okresu**:
   - `Tydzień`,
   - `Miesiąc`,
   - `Rok`.

---

# 4. Sposób wyznaczania zakresów

Wybrana data jest końcem najnowszego okresu.

Aplikacja cofa się od niej o kolejne pełne okresy zgodnie z wybranym typem.

Przykład:

- data końcowa: `16.09.2026`,
- liczba okresów: `4`,
- typ: `Tydzień`.

Wynik: cztery kolejne tygodniowe zakresy liczone wstecz od 16.09.2026.

Analogicznie działa wybór `Miesiąc` i `Rok`.

Okresy nie powinny się nakładać ani pozostawiać luk pomiędzy sobą.

---

# 5. Prezentacja wykresu

- jeden wykres,
- jedna linia = jeden porównywany okres,
- maksymalnie 5 linii,
- legenda pokazuje rzeczywisty zakres dat każdej linii,
- liczba widocznych linii odpowiada wybranej liczbie okresów,
- najnowszy okres może być wizualnie wyróżniony.

Oś X zależy od typu okresu:

- tydzień — dni tygodnia,
- miesiąc — kolejne dni / punkty miesiąca,
- rok — miesiące roku.

---

# 6. Sterowanie na dashboardzie

W panelu „Porównanie okresów” kontrolki znajdują się przy nagłówku wykresu i obejmują:

- pole daty końcowej,
- listę `1–5` liczby okresów,
- listę typu okresu `Tydzień / Miesiąc / Rok`.

Dotychczasowa lista „Ostatnie 4 tygodnie” nie obowiązuje jako osobny tryb.

---

# 7. Dane rzeczywiste

Na etapie makiety wykres korzysta z danych demonstracyjnych.

Po podłączeniu do D1 te same trzy parametry mają sterować rzeczywistym zapytaniem analitycznym:

- `endDate`,
- `periodCount`,
- `periodType`.

Agregacje powinny być wykonywane po stronie Workera / D1.

Frontend ma otrzymywać gotowe serie do narysowania.

---

# 8. Filtry wspólne

W module ANALIZY, tam gdzie ma to sens, przewidujemy również:

- zakres dat,
- kategorię,
- artykuł,
- dostawcę,
- dostawę.

Filtry mają działać wspólnie z parametrami porównania okresów, jeśli dana analiza je obsługuje.

---

# 9. Zasada dokumentacyjna

Powyższe ustawienie porównania okresów jest obowiązującym założeniem projektu i zastępuje wcześniejsze przykłady o stałej liczbie tygodni lub konfiguracji typu `7 dni × 10 okresów`.


---

# 10. Tooltip wartości na wykresie „Sprzedaż w czasie”

Na dashboardzie wykres **Sprzedaż w czasie** pokazuje natychmiastowy hint dla każdego słupka.

Zachowanie:
- po najechaniu kursorem na słupek wyświetla się tooltip,
- tooltip pokazuje datę oraz dokładną wartość sprzedaży w PLN,
- przykład: `18 wrz · 342,00 zł`,
- ten sam opis jest dostępny przez fokus klawiatury,
- rozwiązanie nie zmienia wysokości ani wizualnej skali słupków.

Celem jest możliwość szybkiego odczytania dokładnej wartości bez analizowania osi Y.


---

# 11. „Leon mówi…” — rekomendacje

## Widok na stronie głównej

Dashboard pokazuje szeroki kafel **„Leon mówi…”** pomiędzy górnym panelem aplikacji a panelami Vinted / DNR.

Kafel:
- pokazuje maksymalnie 3 krótkie rady,
- jest szybkim rzutem oka, a nie pełną analizą,
- po kliknięciu prowadzi do `/analizy`.

## Widok w module ANALIZY

Każda rekomendacja pokazuje:
- tytuł / decyzję,
- krótkie podsumowanie,
- **Dlaczego** — dane, które wywołały sugestię,
- **Co robić** — konkretną akcję.

## Źródło i logika

Endpoint: `/api/analysis/recommendations`.

Źródło danych: D1.

Silnik jest celowo deterministyczny. Korzysta m.in. z:
- sprzedaży z ostatnich 7 dni vs poprzednich 7 dni,
- dynamiki kategorii,
- wieku dostawy,
- liczby sztuk pozostałych,
- % zbytu,
- przyspieszenia / zatrzymania rotacji dostawy.

Przykładowe typy rad:
- „Sprawdź dostawę …” — dostawa stoi mimo pozostałego towaru,
- „Nie przeceniaj dostawy …” — rotacja przyspiesza,
- „Wyeksponuj: …” — rosnąca kategoria,
- „Odśwież ekspozycję” — wyraźny spadek sprzedaży tydzień do tygodnia.

Alerty techniczne i problemy z danymi nie są mieszane z rekomendacjami biznesowymi.

## Kierunek dalszego rozwoju

Do dołożenia:
- zapis decyzji `Zrób / Odłóż / Odrzuć`,
- historia skutków decyzji,
- kandydaci do promocji z symulacją,
- radar anomalii,
- Pareto 80/20,
- analiza przedziałów cenowych per typ artykułu,
- podpowiadacz wyceny nowych rzeczy.


---

# 12. Tekst dnia Leona

Pod nagłówkiem **„Leon mówi…”** wyświetlane jest jedno krótkie, luźne zdanie niezwiązane z analizą biznesową.

Źródło:
- tabela D1 `leon_messages` zawiera 100 tekstów,
- tabela `leon_message_history` zapisuje, który tekst został pokazany danego dnia.

Reguły rotacji:
- tekst jest przypisywany do dnia według czasu `Europe/Warsaw`,
- odświeżanie strony nie zmienia tekstu w ciągu dnia,
- wybór nie może użyć żadnego z 99 poprzednich tekstów,
- przy 100 aktywnych wpisach pełna pula przechodzi bez powtórki przez 100 dni,
- po pełnym cyklu tekst może wrócić.

Na kaflu dashboardu nie pokazujemy już napisu **„Przejdź do analiz”**. Cały kafel pozostaje klikalny i prowadzi do modułu ANALIZY.

---

# 13. Daily Leon — automatyczne przygotowanie dnia

## Cel

Tekst dnia i trzy rekomendacje Leona mają być przygotowywane automatycznie na początku każdego dnia, a nie dopiero podczas pierwszego wejścia użytkownika na dashboard.

Dzienny zestaw Leona jest snapshotem. Po jego utworzeniu przez cały dzień dashboard oraz moduł ANALIZY pokazują ten sam tekst i ten sam zestaw rekomendacji.

## Jedna operacja dzienna

Worker ma posiadać wspólną funkcję roboczą, np. `prepareLeonDay(env)`, która:

1. wyznacza bieżącą datę w `Europe/Warsaw`,
2. sprawdza, czy tekst dnia jest już zapisany w `leon_message_history`,
3. jeśli go nie ma — wybiera nowy tekst zgodnie z regułą 100-dniowej rotacji,
4. sprawdza, czy rekomendacje dla bieżącej daty są już zapisane,
5. jeśli ich nie ma — liczy rekomendacje z aktualnych danych D1,
6. zapisuje maksymalnie trzy rekomendacje jako dzienny snapshot,
7. zapisuje czas wygenerowania zestawu.

Operacja musi być **idempotentna**: wielokrotne uruchomienie tego samego dnia nie może losować nowego tekstu ani nadpisywać poprawnie utworzonego zestawu rekomendacji.

## Tabela dziennych rekomendacji

Do zapisania historii rekomendacji przewidujemy tabelę `leon_daily_recommendations`.

Minimalny zakres danych:
- `for_date` — data dnia w `Europe/Warsaw`,
- `position` — pozycja 1–3,
- `recommendation_id`,
- `tone`,
- `badge`,
- `title`,
- `summary`,
- `reason`,
- `action`,
- `priority`,
- `generated_at`.

Klucz dzienny powinien uniemożliwiać zapis dwóch rekomendacji na tej samej pozycji dla tego samego dnia.

Tabela ma pełnić również rolę historii rekomendacji. Nie kasujemy poprzednich dni po wygenerowaniu nowego snapshotu.

## Harmonogram

Cloudflare Worker otrzymuje obsługę `scheduled()`.

Cron uruchamia Workera raz na godzinę. Sam Worker sprawdza datę w `Europe/Warsaw` i wykonuje przygotowanie tylko wtedy, gdy snapshot dla bieżącego dnia jeszcze nie istnieje.

Takie rozwiązanie jest celowe:
- harmonogram Cloudflare działa w UTC,
- północ w Polsce zmienia położenie względem UTC przy zmianie czasu,
- logika oparta na lokalnej dacie eliminuje konieczność ręcznego przełączania harmonogramu lato / zima.

Docelowa konfiguracja:
```toml
[triggers]
crons = ["0 * * * *"]
```

## Zachowanie API

`GET /api/analysis/recommendations` nie powinien standardowo przeliczać rekomendacji przy każdym odczycie.

Docelowy przebieg:
1. odczyt dzisiejszego tekstu i dzisiejszych rekomendacji z D1,
2. zwrot gotowego snapshotu do frontendu,
3. brak zmiany zestawu po odświeżeniu strony.

## Fallback bezpieczeństwa

Endpoint zachowuje mechanizm awaryjny:

- jeżeli dla bieżącej daty nie istnieje kompletny snapshot,
- wywołuje `prepareLeonDay(env)`,
- zapisuje brakujące dane,
- następnie odczytuje i zwraca gotowy zestaw.

Dzięki temu pojedyncze pominięcie Cron Triggera nie powoduje pustego kafla ani błędu w module ANALIZY.

## Stan przejściowy

Przed wdrożeniem Daily Leon:
- rekomendacje są liczone przy każdym wywołaniu `/api/analysis/recommendations`,
- tekst dnia jest losowany przy pierwszym wywołaniu danego dnia i następnie utrwalany w `leon_message_history`.

Po wdrożeniu sekcji 13 ten mechanizm zostaje zastąpiony dziennym snapshotem przygotowywanym automatycznie.
