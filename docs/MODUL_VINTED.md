# PÓŁECZKA IWONKI — MODUŁ VINTED

**Moduł:** VINTED  
**Status:** założenia początkowe / makieta  
**Dokument nadrzędny:** `POLECZKA_PWA_MASTER.md`  
**Aktualizacja:** 17.09.2026

---

## 1. Cel modułu

Moduł VINTED ma obsługiwać sprzedaż realizowaną przez Vinted i powiązać ją z ewidencją sprzedaży Półeczki Iwonki.

Na obecnym etapie moduł jest dodany do:
- menu głównego PWA,
- kafelków szybkiego dostępu na stronie głównej,
- routingu `/vinted`.

Widok modułu jest na razie placeholderem; funkcje integracji będą wdrażane etapami.

---

## 2. Główne założenie integracji

Zakładamy brak dostępnego oficjalnego API Vinted, z którego PWA mogłaby bezpośrednio pobierać sprzedaż.

Celem integracji jest wykrycie sprzedaży Vinted i utworzenie odpowiadającego jej wpisu sprzedaży / dokumentu sprzedaży w systemie Półeczki.

---

## 3. Monitoring sprzedaży

Rozważany model:
- identyfikujemy własne oferty Vinted,
- system okresowo sprawdza ich status,
- dodatkowym źródłem informacji mogą być wiadomości e-mail z Vinted,
- kontrola może odbywać się cyklicznie, np. raz na godzinę,
- po wykryciu sprzedaży zdarzenie trafia do dalszego przetwarzania.

Szczegółowa metoda wykrywania sprzedaży zostanie ustalona przy wdrażaniu integracji.

---

## 4. Dane i D1

Integracja Vinted będzie wymagała osobnych danych technicznych w D1, m.in. do przechowywania:
- identyfikatorów ofert,
- statusu monitorowania,
- wykrytych sprzedaży,
- powiązania sprzedaży Vinted z wpisem sprzedaży w PWA,
- informacji potrzebnych do zapobiegania duplikatom.

Dokładny schemat tabel nie jest jeszcze zatwierdzony.

---

## 5. Zakres bieżącego etapu

W tym etapie wdrażamy wyłącznie wejście do modułu w interfejsie:
- pozycję `Vinted` w menu bocznym,
- kafelek `Vinted` na dashboardzie,
- trasę `/vinted`.

Nie uruchamiamy jeszcze automatycznego monitoringu ani tworzenia sprzedaży.
