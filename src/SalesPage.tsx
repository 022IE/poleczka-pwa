import { useEffect, useMemo, useState } from 'react'
import BuildStatus from './components/BuildStatus'
import DataStatus from './components/DataStatus'

const SHOW_DEV_PIPELINE = false

type DictionaryItem = {
  id: string
  name: string
}

type ItemDictionaryItem = DictionaryItem & {
  categoryId: string | null
}

type SalesSummary = {
  receipts: number
  units: number
  gross: number
  discount: number
  net: number
  averageReceipt: number
}

type Receipt = {
  receiptNumber: string
  date: string
  positions: number
  units: number
  gross: number
  discount: number
  net: number
  payment: string
  sk: boolean
}

type SaleLine = {
  lineId: string
  itemId: string | null
  variantId: string | null
  itemName: string
  category: string
  quantity: number
  price: number
  discount: number
  net: number
  deliveryNo: string
}

type ReceiptsResponse = {
  ok: boolean
  page: number
  pageSize: number
  total: number
  totalPages: number
  items: Receipt[]
}

type SummaryResponse = SalesSummary & {
  ok: boolean
}

type DictionaryResponse<T> = {
  ok: boolean
  items: T[]
}

type LinesResponse = {
  ok: boolean
  items: SaleLine[]
}

const emptySummary: SalesSummary = {
  receipts: 0,
  units: 0,
  gross: 0,
  discount: 0,
  net: 0,
  averageReceipt: 0,
}

function localYmd(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function currentMonthRange() {
  const now = new Date()
  return {
    from: localYmd(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

function todayRange() {
  const today = localYmd(new Date())
  return { from: today, to: today }
}

function lastSevenDaysRange() {
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - 6)
  return {
    from: localYmd(from),
    to: localYmd(today),
  }
}

function displayYmd(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

function formatReceiptDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const moneyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const quantityFormatter = new Intl.NumberFormat('pl-PL', {
  maximumFractionDigits: 2,
})

function formatMoney(value: number) {
  return moneyFormatter.format(Number(value || 0))
}

function formatQuantity(value: number) {
  return quantityFormatter.format(Number(value || 0))
}

function PaymentBadge({ payment }: { payment: string }) {
  const normalized = payment.toLocaleLowerCase('pl-PL')
  const symbol = normalized.includes('gotów') ? '▣' : normalized.includes('kart') ? '▭' : normalized.includes('blik') ? '▯' : '◇'
  const tone = normalized.includes('gotów') ? 'gotówka' : normalized.includes('kart') ? 'karta' : normalized.includes('blik') ? 'blik' : 'inna'
  return <span className={`sales-payment ${tone}`}><i>{symbol}</i>{payment}</span>
}

function SalesHeader() {
  const now = new Date()
  const weekday = new Intl.DateTimeFormat('pl-PL', { weekday: 'long' }).format(now)
  const date = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(now)

  return (
    <header className="dashboard-header sales-header">
      <div className="header-title-block">
        <span className="page-title-icon" aria-hidden="true">▢</span>
        <div>
          <h1>Sprzedaż</h1>
          <p>Tu znajdziesz wszystkie paragony i szczegóły sprzedaży.</p>
        </div>
      </div>
      {SHOW_DEV_PIPELINE && <div className="header-build-slot"><BuildStatus /></div>}
      <div className="header-actions">
        <div className="date-block"><span className="header-icon">▣</span><div><b>{weekday}</b><span>{date}</span></div></div>
        <div className="header-divider" />
        <button className="bell" aria-label="Powiadomienia">♟<span>3</span></button>
        <DataStatus />
        <div className="avatar">I</div>
      </div>
    </header>
  )
}

function SalesPage() {
  const initialRange = useMemo(() => currentMonthRange(), [])
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [draftFrom, setDraftFrom] = useState(initialRange.from)
  const [draftTo, setDraftTo] = useState(initialRange.to)
  const [dateOpen, setDateOpen] = useState(false)

  const [payment, setPayment] = useState('')
  const [category, setCategory] = useState('')
  const [item, setItem] = useState('')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const [payments, setPayments] = useState<DictionaryItem[]>([])
  const [categories, setCategories] = useState<DictionaryItem[]>([])
  const [items, setItems] = useState<ItemDictionaryItem[]>([])

  const [summary, setSummary] = useState<SalesSummary>(emptySummary)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [sort, setSort] = useState('date')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [linesByReceipt, setLinesByReceipt] = useState<Record<string, SaleLine[]>>({})
  const [lineLoading, setLineLoading] = useState<Set<string>>(() => new Set())
  const [skSaving, setSkSaving] = useState<Set<string>>(() => new Set())
  const [openReceiptMenu, setOpenReceiptMenu] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 280)
    return () => window.clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()

    async function loadDictionaries() {
      try {
        const [paymentsResponse, categoriesResponse, itemsResponse] = await Promise.all([
          fetch('/api/dictionaries/payment-types', { signal: controller.signal }),
          fetch('/api/dictionaries/categories', { signal: controller.signal }),
          fetch('/api/dictionaries/items', { signal: controller.signal }),
        ])

        if (!paymentsResponse.ok || !categoriesResponse.ok || !itemsResponse.ok) {
          throw new Error('Nie udało się pobrać list filtrów.')
        }

        const [paymentsPayload, categoriesPayload, itemsPayload] = await Promise.all([
          paymentsResponse.json() as Promise<DictionaryResponse<DictionaryItem>>,
          categoriesResponse.json() as Promise<DictionaryResponse<DictionaryItem>>,
          itemsResponse.json() as Promise<DictionaryResponse<ItemDictionaryItem>>,
        ])

        setPayments(paymentsPayload.items || [])
        setCategories(categoriesPayload.items || [])
        setItems(itemsPayload.items || [])
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') {
          setError('Nie udało się pobrać danych sprzedaży.')
        }
      }
    }

    void loadDictionaries()
    return () => controller.abort()
  }, [reloadKey])

  const filteredItems = useMemo(
    () => category ? items.filter((entry) => entry.categoryId === category) : items,
    [items, category],
  )

  useEffect(() => {
    if (item && !filteredItems.some((entry) => entry.id === item)) {
      setItem('')
    }
  }, [filteredItems, item])

  const filterParams = useMemo(() => {
    const params = new URLSearchParams()
    params.set('from', from)
    params.set('to', to)
    if (payment) params.set('payment', payment)
    if (category) params.set('category', category)
    if (item) params.set('item', item)
    if (debouncedQuery) params.set('search', debouncedQuery)
    return params
  }, [from, to, payment, category, item, debouncedQuery])

  useEffect(() => {
    setPage(1)
  }, [from, to, payment, category, item, debouncedQuery, pageSize])

  useEffect(() => {
    const controller = new AbortController()

    async function loadSummary() {
      setSummaryLoading(true)
      try {
        const response = await fetch(`/api/sales/summary?${filterParams.toString()}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Summary failed')
        const payload = await response.json() as SummaryResponse
        setSummary({
          receipts: payload.receipts || 0,
          units: payload.units || 0,
          gross: payload.gross || 0,
          discount: payload.discount || 0,
          net: payload.net || 0,
          averageReceipt: payload.averageReceipt || 0,
        })
        setError('')
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') {
          setError('Nie udało się pobrać danych sprzedaży.')
        }
      } finally {
        if (!controller.signal.aborted) setSummaryLoading(false)
      }
    }

    void loadSummary()
    return () => controller.abort()
  }, [filterParams, reloadKey])

  useEffect(() => {
    const controller = new AbortController()

    async function loadReceipts() {
      setLoading(true)
      const params = new URLSearchParams(filterParams)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      params.set('sort', sort)
      params.set('order', order)

      try {
        const response = await fetch(`/api/sales/receipts?${params.toString()}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Receipts failed')
        const payload = await response.json() as ReceiptsResponse
        setReceipts(payload.items || [])
        setPage(payload.page || 1)
        setPageSize(payload.pageSize || pageSize)
        setTotal(payload.total || 0)
        setTotalPages(payload.totalPages || 1)
        setError('')
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') {
          setError('Nie udało się pobrać danych sprzedaży.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadReceipts()
    return () => controller.abort()
  }, [filterParams, page, pageSize, sort, order, reloadKey])

  const kpis = useMemo(() => [
    ['Paragony', String(summary.receipts), '▤', 'green'],
    ['Sprzedane sztuki', formatQuantity(summary.units), '◇', 'gold'],
    ['Sprzedaż brutto', formatMoney(summary.gross), '▥', 'green'],
    ['Rabaty', formatMoney(summary.discount), '%', 'rose'],
    ['Sprzedaż netto', formatMoney(summary.net), '▣', 'green'],
    ['Średni paragon', formatMoney(summary.averageReceipt), '◇', 'gold'],
  ] as const, [summary])

  const applyDateRange = () => {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return
    setFrom(draftFrom)
    setTo(draftTo)
    setDateOpen(false)
  }

  const selectDatePreset = (preset: 'today' | '7days' | 'month') => {
    const range = preset === 'today'
      ? todayRange()
      : preset === '7days'
        ? lastSevenDaysRange()
        : currentMonthRange()

    setDraftFrom(range.from)
    setDraftTo(range.to)
  }

  const activeDatePreset = useMemo(() => {
    const presets = [
      ['today', todayRange()],
      ['7days', lastSevenDaysRange()],
      ['month', currentMonthRange()],
    ] as const

    return presets.find(([, range]) => range.from === draftFrom && range.to === draftTo)?.[0] ?? null
  }, [draftFrom, draftTo])

  const toggleSort = (nextSort: string) => {
    if (sort === nextSort) {
      setOrder((current) => current === 'desc' ? 'asc' : 'desc')
    } else {
      setSort(nextSort)
      setOrder('desc')
    }
    setPage(1)
  }

  const sortArrow = (column: string) => sort === column ? (order === 'desc' ? '↓' : '↑') : '↕'

  const fetchReceiptLines = async (receiptNumber: string) => {
    try {
      const response = await fetch(`/api/sales/receipts/${encodeURIComponent(receiptNumber)}/lines`)
      if (!response.ok) throw new Error('Lines failed')
      const payload = await response.json() as LinesResponse
      return payload.items || []
    } catch {
      return []
    }
  }

  const toggleReceipt = async (receiptNumber: string) => {
    if (expanded.has(receiptNumber)) {
      setExpanded((current) => {
        const next = new Set(current)
        next.delete(receiptNumber)
        return next
      })
      return
    }

    setExpanded((current) => new Set(current).add(receiptNumber))
    if (linesByReceipt[receiptNumber] || lineLoading.has(receiptNumber)) return

    setLineLoading((current) => new Set(current).add(receiptNumber))
    const lines = await fetchReceiptLines(receiptNumber)
    setLinesByReceipt((current) => ({ ...current, [receiptNumber]: lines }))
    setLineLoading((current) => {
      const next = new Set(current)
      next.delete(receiptNumber)
      return next
    })
  }

  const visibleReceiptNumbers = receipts.map((receipt) => receipt.receiptNumber)
  const allVisibleExpanded = visibleReceiptNumbers.length > 0
    && visibleReceiptNumbers.every((receiptNumber) => expanded.has(receiptNumber))

  const toggleAllReceipts = async () => {
    if (!visibleReceiptNumbers.length) return

    if (allVisibleExpanded) {
      setExpanded((current) => {
        const next = new Set(current)
        visibleReceiptNumbers.forEach((receiptNumber) => next.delete(receiptNumber))
        return next
      })
      return
    }

    setExpanded((current) => {
      const next = new Set(current)
      visibleReceiptNumbers.forEach((receiptNumber) => next.add(receiptNumber))
      return next
    })

    const missing = visibleReceiptNumbers.filter(
      (receiptNumber) => !linesByReceipt[receiptNumber] && !lineLoading.has(receiptNumber),
    )
    if (!missing.length) return

    setLineLoading((current) => {
      const next = new Set(current)
      missing.forEach((receiptNumber) => next.add(receiptNumber))
      return next
    })

    const loaded = await Promise.all(
      missing.map(async (receiptNumber) => [receiptNumber, await fetchReceiptLines(receiptNumber)] as const),
    )

    setLinesByReceipt((current) => ({
      ...current,
      ...Object.fromEntries(loaded),
    }))
    setLineLoading((current) => {
      const next = new Set(current)
      missing.forEach((receiptNumber) => next.delete(receiptNumber))
      return next
    })
  }

  const updateReceiptSk = async (receiptNumber: string, nextSk: boolean) => {
    const previous = receipts.find((receipt) => receipt.receiptNumber === receiptNumber)?.sk
    if (previous === undefined || previous === nextSk || skSaving.has(receiptNumber)) return

    setError('')
    setReceipts((current) => current.map((receipt) => (
      receipt.receiptNumber === receiptNumber ? { ...receipt, sk: nextSk } : receipt
    )))
    setSkSaving((current) => new Set(current).add(receiptNumber))

    try {
      const response = await fetch(`/api/sales/receipts/${encodeURIComponent(receiptNumber)}/sk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sk: nextSk }),
      })
      if (!response.ok) throw new Error('SK update failed')
      const payload = await response.json() as { ok: boolean; sk: boolean }
      setReceipts((current) => current.map((receipt) => (
        receipt.receiptNumber === receiptNumber ? { ...receipt, sk: Boolean(payload.sk) } : receipt
      )))
    } catch {
      setReceipts((current) => current.map((receipt) => (
        receipt.receiptNumber === receiptNumber ? { ...receipt, sk: previous } : receipt
      )))
      setError(`Nie udało się zapisać S.K. dla paragonu ${receiptNumber}.`)
    } finally {
      setSkSaving((current) => {
        const next = new Set(current)
        next.delete(receiptNumber)
        return next
      })
    }
  }

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
    const candidates = new Set([1, totalPages, page - 1, page, page + 1])
    return [...candidates].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b)
  }, [page, totalPages])

  return (
    <div className="sales-wrap">
      <SalesHeader />

      <section className="sales-kpi-grid" aria-label="Podsumowanie sprzedaży">
        {kpis.map(([label, value, icon, tone]) => (
          <article className={`sales-kpi-card ${summaryLoading ? 'is-loading' : ''}`} key={label}>
            <span className={`sales-kpi-icon ${tone}`}>{icon}</span>
            <div><span>{label}</span><strong>{summaryLoading ? '—' : value}</strong></div>
          </article>
        ))}
      </section>

      <section className="sales-filters" aria-label="Filtry sprzedaży">
        <div className="sales-filter sales-filter-date">
          <span className="sales-filter-icon gold">▣</span>
          <span className="sales-filter-copy">
            <small>Zakres dat</small>
            <button
              type="button"
              className="sales-date-trigger"
              aria-expanded={dateOpen}
              onClick={() => {
                setDraftFrom(from)
                setDraftTo(to)
                setDateOpen((current) => !current)
              }}
            >
              {displayYmd(from)} <b>—</b> {displayYmd(to)} <i>⌄</i>
            </button>
          </span>
          {dateOpen && (
            <div className="sales-date-popover">
              <div className="sales-date-presets" aria-label="Szybki wybór zakresu dat">
                <button type="button" className={activeDatePreset === 'today' ? 'active' : ''} onClick={() => selectDatePreset('today')}>Dzisiaj</button>
                <button type="button" className={activeDatePreset === '7days' ? 'active' : ''} onClick={() => selectDatePreset('7days')}>7 dni</button>
                <button type="button" className={activeDatePreset === 'month' ? 'active' : ''} onClick={() => selectDatePreset('month')}>Miesiąc</button>
              </div>
              <div className="sales-date-fields">
                <label><span>Od</span><input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} /></label>
                <label><span>Do</span><input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} /></label>
              </div>
              {draftFrom > draftTo && <small className="sales-date-error">Data „od” nie może być późniejsza niż „do”.</small>}
              <div className="sales-date-actions">
                <button type="button" className="primary" disabled={!draftFrom || !draftTo || draftFrom > draftTo} onClick={applyDateRange}>Zastosuj</button>
              </div>
            </div>
          )}
        </div>

        <label className="sales-filter">
          <span className="sales-filter-icon blue">▭</span>
          <span className="sales-filter-copy">
            <small>Płatności</small>
            <select value={payment} onChange={(event) => setPayment(event.target.value)}>
              <option value="">Wszystkie</option>
              {payments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </span>
        </label>

        <label className="sales-filter">
          <span className="sales-filter-icon gold">◇</span>
          <span className="sales-filter-copy">
            <small>Kategoria</small>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Wszystkie</option>
              {categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </span>
        </label>

        <label className="sales-filter">
          <span className="sales-filter-icon green">♧</span>
          <span className="sales-filter-copy">
            <small>Artykuł</small>
            <select value={item} onChange={(event) => setItem(event.target.value)}>
              <option value="">Wszystkie</option>
              {filteredItems.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </span>
        </label>

        <label className="sales-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj paragonu, artykułu lub nr dostawy..."
          />
          {query && <button type="button" aria-label="Wyczyść wyszukiwanie" onClick={() => setQuery('')}>×</button>}
        </label>
      </section>

      {error && (
        <div className="sales-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((current) => current + 1)}>Spróbuj ponownie</button>
        </div>
      )}

      <section className="sales-table-card">
        <div className="sales-table-scroll">
          <div className="sales-table" role="table" aria-label="Paragony">
            <div className="sales-table-head sales-table-grid" role="row">
              <button
                type="button"
                className="sales-expand-all"
                disabled={loading || receipts.length === 0}
                aria-label={allVisibleExpanded ? 'Zwiń wszystkie paragony na stronie' : 'Rozwiń wszystkie paragony na stronie'}
                title={allVisibleExpanded ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'}
                aria-pressed={allVisibleExpanded}
                onClick={() => void toggleAllReceipts()}
              >
                {allVisibleExpanded ? '⊟' : '⊞'}
              </button>
              <span>Paragon</span>
              <button type="button" className="sales-sort" onClick={() => toggleSort('date')}>Data <b>{sortArrow('date')}</b></button>
              <span>Pozycji</span>
              <button type="button" className="sales-sort" onClick={() => toggleSort('units')}>Szt. <b>{sortArrow('units')}</b></button>
              <button type="button" className="sales-sort" onClick={() => toggleSort('gross')}>Brutto <b>{sortArrow('gross')}</b></button>
              <button type="button" className="sales-sort" onClick={() => toggleSort('discount')}>Rabat <b>{sortArrow('discount')}</b></button>
              <button type="button" className="sales-sort" onClick={() => toggleSort('net')}>Netto <b>{sortArrow('net')}</b></button>
              <span>Płatność</span>
              <span className="sales-sk-head">S.K.</span>
              <span className="sales-menu-dots">⋮</span>
            </div>

            {loading && <div className="sales-empty">Pobieram sprzedaż z D1…</div>}
            {!loading && !error && receipts.length === 0 && <div className="sales-empty">Brak sprzedaży dla wybranych filtrów.</div>}

            {!loading && receipts.map((receipt, receiptIndex) => {
              const isExpanded = expanded.has(receipt.receiptNumber)
              const lines = linesByReceipt[receipt.receiptNumber]
              const isLineLoading = lineLoading.has(receipt.receiptNumber)

              return (
                <div className={`sales-receipt-group ${receiptIndex % 2 ? 'alt' : ''} ${isExpanded ? 'expanded' : ''}`} key={receipt.receiptNumber}>
                  <div className="sales-receipt-row sales-table-grid" role="row">
                    <button type="button" className="sales-expand" onClick={() => void toggleReceipt(receipt.receiptNumber)} aria-label={`${isExpanded ? 'Zwiń' : 'Rozwiń'} paragon ${receipt.receiptNumber}`}>{isExpanded ? '−' : '+'}</button>
                    <strong>{receipt.receiptNumber}</strong>
                    <span>{formatReceiptDate(receipt.date)}</span>
                    <span>{receipt.positions}</span>
                    <span>{formatQuantity(receipt.units)}</span>
                    <span>{formatMoney(receipt.gross)}</span>
                    <span>{formatMoney(receipt.discount)}</span>
                    <strong>{formatMoney(receipt.net)}</strong>
                    <PaymentBadge payment={receipt.payment} />
                    <label className={`sales-sk ${skSaving.has(receipt.receiptNumber) ? 'saving' : ''}`}>
                      <input
                        type="checkbox"
                        checked={receipt.sk}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        aria-label={`S.K. dla paragonu ${receipt.receiptNumber}`}
                        title={receipt.sk ? 'S.K. zaksięgowane' : 'S.K. wyksięgowane'}
                      />
                    </label>
                    <button
                      type="button"
                      className="sales-row-menu"
                      aria-label={`Menu paragonu ${receipt.receiptNumber}`}
                      aria-expanded={openReceiptMenu === receipt.receiptNumber}
                      onClick={() => setOpenReceiptMenu((current) => current === receipt.receiptNumber ? null : receipt.receiptNumber)}
                    >•••</button>
                  </div>

                  {openReceiptMenu === receipt.receiptNumber && (
                    <div className="sales-row-actions" role="menu" aria-label={`Akcje paragonu ${receipt.receiptNumber}`}>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={receipt.sk || skSaving.has(receipt.receiptNumber)}
                        onClick={() => {
                          setOpenReceiptMenu(null)
                          void updateReceiptSk(receipt.receiptNumber, true)
                        }}
                      >Zaksięguj</button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!receipt.sk || skSaving.has(receipt.receiptNumber)}
                        onClick={() => {
                          setOpenReceiptMenu(null)
                          void updateReceiptSk(receipt.receiptNumber, false)
                        }}
                      >Wyksięguj</button>
                      <button type="button" role="menuitem" className="danger" disabled title="Funkcja zostanie dodana później">Usuń</button>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="sales-lines-wrap">
                      {isLineLoading ? (
                        <div className="sales-lines-empty">Pobieram pozycje paragonu…</div>
                      ) : lines?.length ? (
                        <div className="sales-lines-table">
                          <div className="sales-lines-head sales-lines-grid">
                            <span>Artykuł</span><span>Kategoria</span><span>Ilość</span><span>Cena</span><span>Rabat</span><span>Netto</span><span>Lp. dostawy</span>
                          </div>
                          {lines.map((line, lineIndex) => {
                            const tone = ['rose', 'green', 'gold', 'blue'][lineIndex % 4]
                            return (
                              <div className={`sales-line sales-lines-grid ${lineIndex % 2 ? 'alt' : ''}`} key={line.lineId}>
                                <span className="sales-line-name"><i className={`sales-dot ${tone}`} />{line.itemName}</span>
                                <span className="sales-line-category"><i className={`sales-dot soft-${tone}`} />{line.category}</span>
                                <span>{formatQuantity(line.quantity)}</span>
                                <span>{formatMoney(line.price)}</span>
                                <span>{formatMoney(line.discount)}</span>
                                <strong>{formatMoney(line.net)}</strong>
                                <span>{line.deliveryNo}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : <div className="sales-lines-empty">Brak pozycji dla tego paragonu.</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <footer className="sales-footer">
        <div className="sales-hint"><i>i</i><span>Kliknij w <b>+</b>, aby rozwinąć paragon i zobaczyć jego pozycje. Łącznie: {total}.</span></div>
        <div className="sales-footer-controls">
          <label className="sales-page-size"><span>Na stronę</span><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
          <nav className="sales-pagination" aria-label="Paginacja sprzedaży">
            <button type="button" aria-label="Poprzednia strona" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>
            {pageNumbers.map((pageNumber, index) => (
              <span className="sales-page-fragment" key={pageNumber}>
                {index > 0 && pageNumber - pageNumbers[index - 1] > 1 && <span className="sales-page-gap">…</span>}
                <button type="button" className={pageNumber === page ? 'active' : ''} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
              </span>
            ))}
            <button type="button" aria-label="Następna strona" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>›</button>
          </nav>
        </div>
      </footer>
    </div>
  )
}

export default SalesPage
