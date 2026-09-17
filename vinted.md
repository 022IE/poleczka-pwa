# VINTED — ustalenia integracji

## Status
Na ten moment integracja **nie jest wdrażana**. Ten plik zapisuje wyłącznie ustalenia projektowe do późniejszej realizacji.

---

## 1. Cel integracji

Celem integracji z Vinted nie jest pełna synchronizacja ofert ani zarządzanie aukcjami.

Interesuje nas wyłącznie:

- wykrycie, że wystawiony na Vinted produkt został sprzedany,
- powiązanie tej sprzedaży z konkretnym produktem / SKU w systemie Półeczki Iwonki,
- utworzenie wpisu sprzedaży w Loyverse,
- dalsze zapisanie sprzedaży do istniejącej bazy D1 przez działający już webhook Loyverse.

Vinted ma być traktowane jako **źródło zdarzenia sprzedaży**, a nie jako główny system sprzedażowy.

---

## 2. Założenie dotyczące API Vinted

Zakładamy, że oficjalne API Vinted nie jest dostępne dla naszego konta.

Nie opieramy rozwiązania na nieoficjalnym API, scrapingu ani automatycznym odpytywaniu stron Vinted.

Powód:

- takie rozwiązanie byłoby kruche,
- zmiany po stronie Vinted mogłyby je łatwo zepsuć,
- samo zniknięcie oferty nie musi oznaczać sprzedaży,
- oferta może zostać ukryta, usunięta lub zablokowana,
- automatyczne scrapowanie strony nie jest dobrym fundamentem dla systemu sprzedażowego.

---

## 3. Sposób wykrywania sprzedaży

Podstawowym źródłem informacji o sprzedaży ma być **wiadomość e-mail wysyłana przez Vinted po sprzedaży produktu**.

Docelowy przepływ:

Vinted  
→ Gmail Półeczki Iwonki  
→ filtr / przekazanie wybranych wiadomości  
→ dedykowany adres techniczny Cloudflare Email Worker  
→ Worker  
→ D1  
→ utworzenie sprzedaży w Loyverse  
→ istniejący webhook Loyverse  
→ `receipts` i `receipt_lines` w D1

Dzięki temu nie trzeba sprawdzać Vinted co godzinę.

Sprzedaż może zostać przetworzona praktycznie natychmiast po otrzymaniu wiadomości.

---

## 4. Gmail

Półeczka Iwonki ma już własny adres Gmail.

Nie planujemy zakładania osobnego Gmaila tylko dla Workera.

Lepszy wariant:

- istniejący Gmail pozostaje główną skrzynką,
- wiadomości z Vinted nadal są dostępne normalnie w Gmailu,
- Gmail przekazuje wybrane wiadomości do technicznego adresu obsługiwanego przez Cloudflare Email Worker.

Przykładowy adres techniczny:

`vinted@...`

W przyszłości podobny schemat może zostać wykorzystany dla innych kanałów:

- `allegro@...`
- `olx@...`
- inne marketplace’y

Worker nie powinien mieć dostępu do całej skrzynki Gmail.

---

## 5. Filtr wiadomości

Docelowo w Gmailu powstanie filtr rozpoznający wiadomości dotyczące sprzedaży na Vinted.

Schemat:

nadawca Vinted + wiadomość o sprzedaży  
→ opcjonalna etykieta `VINTED_SPRZEDAŻ`  
→ automatyczne przekazanie do adresu technicznego Workera

Dokładne warunki filtra zostaną ustalone dopiero po analizie rzeczywistej wiadomości o sprzedaży z Vinted.

---

## 6. Powiązanie aukcji z produktem

Każda oferta Vinted powinna być powiązana z naszym produktem.

Podstawowe powiązanie:

`vinted_item_id`  
→ `SKU`

Przykład:

- Vinted ID: `123456789`
- SKU: `000451`
- cena wystawienia: `49.00 PLN`

Numer aukcji / ID Vinted będzie przechowywany w naszej bazie.

Na późniejszym etapie może być również widoczny w PWA przy produkcie.

---

## 7. Dane wymagane z wiadomości Vinted

Worker powinien próbować rozpoznać co najmniej:

- numer / ID oferty Vinted,
- produkt,
- cenę sprzedaży,
- datę sprzedaży,
- unikalny identyfikator wiadomości.

Jeżeli mail nie zawiera bezpośrednio ID oferty, trzeba sprawdzić, jakie dane rzeczywiście znajdują się w wiadomości.

Dlatego przed wdrożeniem parsera potrzebny będzie **jeden prawdziwy przykładowy mail o sprzedaży z Vinted**.

---

## 8. Zasada bezpieczeństwa

Jeżeli wiadomość jest niejednoznaczna, system **nie może automatycznie tworzyć sprzedaży na podstawie zgadywania**.

Przykładowe sytuacje:

- brak numeru aukcji,
- brak jednoznacznego SKU,
- brak ceny,
- kilka produktów o tej samej nazwie,
- nietypowy format wiadomości.

W takiej sytuacji rekord powinien otrzymać status:

`REVIEW`

i później być widoczny w PWA jako sprzedaż wymagająca sprawdzenia.

---

## 9. Tworzenie sprzedaży w Loyverse

Po poprawnym rozpoznaniu sprzedaży Worker ma utworzyć sprzedaż w Loyverse.

Docelowo zostanie użyte Loyverse API do tworzenia receipt.

Do sprzedaży powinny trafić m.in.:

- właściwy produkt / SKU,
- cena sprzedaży,
- data sprzedaży,
- odpowiednia forma płatności,
- źródło / oznaczenie Vinted,
- ewentualnie numer aukcji Vinted w polu pomocniczym.

Po utworzeniu sprzedaży w Loyverse istniejący webhook Loyverse zapisze dane do:

- `receipts`
- `receipt_lines`

Nie chcemy tworzyć niezależnego drugiego systemu ewidencji sprzedaży.

---

## 10. Ważna uwaga o „paragonie”

API Loyverse tworzy `receipt` w Loyverse.

Nie należy automatycznie utożsamiać tego z fiskalnym paragonem w rozumieniu urządzenia fiskalnego.

Sposób fiskalizacji zależy od późniejszej konfiguracji systemu.

---

## 11. Proponowana struktura D1

Na późniejszym etapie zaproponowano trzy pomocnicze tabele.

### 11.1. `vinted_listings`

Tabela powiązań ofert Vinted z produktami.

Proponowane pola:

- `vinted_item_id`
- `sku`
- `title`
- `vinted_url`
- `asking_price`
- `currency`
- `status`
- `created_at`
- `updated_at`
- `sold_at`

Proponowane statusy:

- `ACTIVE`
- `SOLD`
- `INACTIVE`

---

### 11.2. `vinted_messages`

Rejestr wiadomości odebranych od Vinted.

Cel:

- kontrola przetwarzania,
- zabezpieczenie przed ponownym przetworzeniem tej samej wiadomości,
- diagnostyka błędów.

Proponowane pola:

- `message_id`
- `dedupe_key`
- `received_at`
- `sender`
- `subject`
- `vinted_item_id`
- `processing_status`
- `processed_at`
- `error`

Proponowane statusy:

- `RECEIVED`
- `PROCESSED`
- `IGNORED`
- `REVIEW`
- `ERROR`

Nie planujemy przechowywać pełnej treści maila, jeżeli nie będzie to konieczne.

---

### 11.3. `vinted_sales`

Rejestr wykrytych sprzedaży Vinted.

Cel:

- kontrola procesu tworzenia sprzedaży,
- powiązanie sprzedaży Vinted z utworzonym receipt Loyverse,
- zabezpieczenie przed duplikatami.

Proponowane pola:

- `id`
- `vinted_item_id`
- `message_id`
- `sale_price`
- `currency`
- `sold_at`
- `status`
- `loyverse_receipt_id`
- `loyverse_receipt_number`
- `created_at`
- `updated_at`
- `error`

Proponowane statusy:

- `DETECTED`
- `CREATING_RECEIPT`
- `RECEIPT_CREATED`
- `REVIEW`
- `ERROR`

---

## 12. Zabezpieczenie przed duplikatami

System musi mieć co najmniej dwa poziomy zabezpieczenia:

1. unikalność wiadomości e-mail,
2. unikalność sprzedaży dla konkretnego `vinted_item_id`.

Założenie:

jedna oferta Vinted  
→ maksymalnie jedna automatycznie utworzona sprzedaż

Nawet jeżeli:

- Gmail przekaże wiadomość ponownie,
- Worker wykona retry,
- wystąpi chwilowy błąd połączenia,
- ten sam mail zostanie dostarczony więcej niż raz,

nie może powstać drugi receipt.

---

## 13. Proponowany przebieg procesu

Przykład:

1. Produkt zostaje wystawiony na Vinted.
2. W D1 zapisujemy:
   - `vinted_item_id`
   - `sku`
   - cenę
   - status `ACTIVE`
3. Produkt zostaje sprzedany.
4. Vinted wysyła wiadomość e-mail.
5. Gmail przekazuje ją do Cloudflare Email Worker.
6. Worker zapisuje wiadomość w `vinted_messages`.
7. Worker rozpoznaje aukcję i SKU.
8. Worker tworzy wpis w `vinted_sales`.
9. Status sprzedaży:
   - `DETECTED`
10. Worker przed wysłaniem do Loyverse ustawia:
    - `CREATING_RECEIPT`
11. Worker tworzy receipt w Loyverse.
12. Po sukcesie:
    - `RECEIPT_CREATED`
    - zapis `loyverse_receipt_id`
    - zapis `loyverse_receipt_number`
13. `vinted_listings.status` zmienia się na:
    - `SOLD`
14. Istniejący webhook Loyverse zapisuje receipt do głównych tabel:
    - `receipts`
    - `receipt_lines`

---

## 14. Architektura docelowa

Najważniejsza zasada:

**Vinted nie tworzy osobnego systemu sprzedaży.**

Warstwa Vinted służy wyłącznie do:

- rozpoznania zdarzenia,
- kontroli procesu,
- powiązania go z produktem,
- zlecenia utworzenia sprzedaży w Loyverse.

Główne dane sprzedażowe nadal pozostają w istniejącej architekturze:

Loyverse  
→ webhook  
→ D1  
→ PWA / raporty

---

## 15. Rzeczy do ustalenia przed wdrożeniem

Przed rozpoczęciem implementacji trzeba ustalić:

1. Jak dokładnie wygląda prawdziwy mail Vinted o sprzedaży.
2. Czy wiadomość zawiera:
   - ID oferty,
   - nazwę produktu,
   - cenę,
   - datę,
   - link do oferty.
3. Jaką formę płatności zastosować w Loyverse dla sprzedaży Vinted.
4. Jak oznaczać źródło sprzedaży Vinted w Loyverse.
5. Gdzie w PWA ma być wpisywany numer aukcji Vinted.
6. Czy numer aukcji ma być obowiązkowy przed wystawieniem produktu.
7. Jak prezentować rekordy `REVIEW` i `ERROR` w PWA.
8. Jak dokładnie rozwiązać kwestię fiskalizacji.

---

## 16. Decyzja na teraz

Na obecnym etapie:

- nie tworzymy tabel,
- nie zmieniamy D1,
- nie zmieniamy Workera,
- nie konfigurujemy Gmaila,
- nie konfigurujemy Cloudflare Email Routing,
- nie tworzymy jeszcze parsera maili.

Dokument zapisuje ustalenia do późniejszej realizacji.

---

## 17. Powiadomienia Telegram dla Vinted

Powiadomienia Vinted mają korzystać z **tego samego wspólnego mechanizmu powiadomień**, który jest przygotowywany dla Półeczki Iwonki. Nie tworzymy osobnego bota ani osobnej infrastruktury tylko dla Vinted.

Na etapie przejściowym kanałem powiadomień jest Telegram. Docelowo, po powstaniu własnej aplikacji POS, kanał Telegram będzie można zastąpić lub uzupełnić powiadomieniami push bez zmiany logiki biznesowej.

### 17.1. Bot

Używany jest istniejący bot:

`@PoleczkaIwonkiBot`

Test wysyłki wiadomości został wykonany poprawnie. Identyfikator czatu testowego:

`8976399237`

Token bota **nie może być zapisany w tym pliku ani na stałe w kodzie repozytorium**. W wersji wdrożeniowej ma być przechowywany jako sekret / zmienna środowiskowa Cloudflare Workera.

### 17.2. Typy powiadomień Vinted

Przewidujemy co najmniej cztery podstawowe zdarzenia:

1. `VINTED_SALE_DETECTED` — wykryto sprzedaż Vinted.
2. `VINTED_RECEIPT_CREATED` — sprzedaż została poprawnie utworzona w Loyverse.
3. `VINTED_REVIEW` — sprzedaż wymaga ręcznego sprawdzenia, np. nie udało się jednoznacznie dopasować aukcji do SKU.
4. `VINTED_ERROR` — wystąpił błąd przetwarzania lub tworzenia sprzedaży.

Przykładowe komunikaty użytkowe:

- `🛍️ SPRZEDAŻ VINTED`
- `✅ VINTED → LOYVERSE`
- `⚠️ VINTED — WYMAGA SPRAWDZENIA`
- `❌ BŁĄD VINTED`

### 17.3. Dane w powiadomieniu

Jeżeli są dostępne, wiadomość Telegram powinna zawierać:

- nazwę produktu,
- SKU,
- cenę sprzedaży,
- `vinted_item_id`,
- status procesu,
- numer receipt / paragonu Loyverse po jego utworzeniu,
- krótki opis błędu lub powodu `REVIEW`, jeśli wystąpił.

Przykład po pełnym sukcesie:

`🛍️ SPRZEDAŻ VINTED`  
`Sukienka Zara`  
`SKU: 00451`  
`Cena: 49,00 zł`  
`Vinted ID: 123456789`  
`✅ Sprzedaż została utworzona w Loyverse`  
`Paragon: 2-0123`

### 17.4. Zasada wysyłania

Powiadomienie nie może sterować logiką sprzedaży. Najpierw zmiana stanu procesu jest zapisywana w D1, a dopiero potem wysyłana jest informacja przez wybrany kanał.

Brak działania Telegrama nie może powodować ponownego utworzenia sprzedaży ani duplikatu receipt.

Mechanizm powiadomień powinien mieć własne zabezpieczenie przed wielokrotnym wysłaniem tego samego zdarzenia.

### 17.5. Wspólna architektura powiadomień

Telegram ma obsługiwać zarówno alerty z istniejącego systemu Loyverse, jak i nowe alerty Vinted.

Przykładowe źródła zdarzeń:

- `LOYVERSE` — np. brak numeru dostawy w `receipt_lines.line_note`,
- `VINTED` — sprzedaż, `REVIEW`, `ERROR`, utworzenie receipt.

Docelowa logika powiadomień powinna być niezależna od kanału:

zdarzenie systemowe  
→ zapis stanu w D1  
→ moduł powiadomień  
→ Telegram teraz / push w aplikacji POS później

Dzięki temu przejście z Telegrama na własne powiadomienia push nie będzie wymagało przebudowy integracji Vinted ani integracji Loyverse.
