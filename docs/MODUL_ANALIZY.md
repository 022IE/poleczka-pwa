# PÓŁECZKA IWONKI — MODUŁ ANALIZY

**Moduł:** 04 — ANALIZY  
**Status:** specyfikacja bieżąca v0.1  
**Dokument nadrzędny:** `POLECZKA_PWA_MASTER.md`  
**Aktualizacja:** 16.09.2026

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
