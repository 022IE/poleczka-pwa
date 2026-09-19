# PÓŁECZKA IWONKI — MODUŁ ANALIZY

**Moduł:** 04 — ANALIZY  
**Status:** specyfikacja bieżąca v0.3  
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

## Źródło i logika v0.2

Endpoint: `/api/analysis/recommendations`.

Źródło danych: D1.

Pierwszy silnik jest celowo deterministyczny. Korzysta m.in. z:
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
- tekst jest wybierany raz na dzień według czasu `Europe/Warsaw`,
- odświeżanie strony nie zmienia tekstu w ciągu dnia,
- wybór nie może użyć żadnego z 99 poprzednich tekstów,
- przy 100 aktywnych wpisach pełna pula przechodzi bez powtórki przez 100 dni,
- po pełnym cyklu tekst może wrócić.

Na kaflu dashboardu nie pokazujemy już napisu **„Przejdź do analiz”**. Cały kafel pozostaje klikalny i prowadzi do modułu ANALIZY.
