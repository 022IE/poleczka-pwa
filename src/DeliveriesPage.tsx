import { FormEvent, useEffect, useMemo, useState } from 'react'
import BuildStatus from './components/BuildStatus'
import DataStatus from './components/DataStatus'

const SHOW_DEV_PIPELINE = false

type DeliverySummary = {
  activeDeliveries: number
  receivedUnits: number
  sellThrough: number
  sales: number
  profit: number
  bestSupplier: string | null
}

type Delivery = {
  deliveryNumber: number
  deliveryDate: string
  supplierName: string
  quantity: number
  totalCost: number
  unitCost: number
  sold: number
  sellThrough: number
  returnRate: number
  sales: number
  profit: number
  active: boolean
}

type DeliveryItem = {
  itemId: string | null
  itemName: string
  category: string
  quantity: number
  sales: number
}

type DeliveryListResponse = { ok: boolean; items: Delivery[] }
type DeliverySummaryResponse = DeliverySummary & { ok: boolean }
type DeliveryItemsResponse = { ok: boolean; items: DeliveryItem[] }
type SuppliersResponse = { ok: boolean; items: string[] }
type CategoriesResponse = { ok: boolean; items: Array<{ id: string; name: string }> }

const emptySummary: DeliverySummary = {
  activeDeliveries: 0,
  receivedUnits: 0,
  sellThrough: 0,
  sales: 0,
  profit: 0,
  bestSupplier: null,
}

const moneyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const numberFormatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 })
const percentFormatter = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function formatMoney(value: number) { return moneyFormatter.format(Number(value || 0)) }
function formatNumber(value: number) { return numberFormatter.format(Number(value || 0)) }
function formatPercent(value: number) { return `${percentFormatter.format(Number(value || 0))}%` }

function displayYmd(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

function localYmd(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function DeliveriesHeader() {
  const now = new Date()
  const weekday = new Intl.DateTimeFormat('pl-PL', { weekday: 'long' }).format(now)
  const date = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(now)

  return (
    <header className="dashboard-header deliveries-header">
      <div className="header-title-block">
        <span className="page-title-icon" aria-hidden="true">▣</span>
        <div>
          <h1>Dostawy</h1>
          <p>Kontroluj koszt, zbyt i wynik każdej dostawy.</p>
        </div>
      </div>
      {SHOW_DEV_PIPELINE && <div className="header-build-slot"><BuildStatus /></div>}
      <div className="header-actions">
        <div className="date-block"><span className="header-icon">▣</span><div><b>{weekday}</b><span>{date}</span></div></div>
        <div className="header-divider" />
        <button className="bell" aria-label="Powiadomienia">♟</button>
        <DataStatus />
        <div className="avatar">I</div>
      </div>
    </header>
  )
}

export default function DeliveriesPage() {
  const [summary, setSummary] = useState<DeliverySummary>(emptySummary)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')
  const [dateOpen, setDateOpen] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [itemsByDelivery, setItemsByDelivery] = useState<Record<number, DeliveryItem[]>>({})
  const [itemLoading, setItemLoading] = useState<Set<number>>(() => new Set())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [sort, setSort] = useState<keyof Delivery>('deliveryNumber')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

  const [addOpen, setAddOpen] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [newDate, setNewDate] = useState(localYmd())
  const [newSupplier, setNewSupplier] = useState('')
  const [newQuantity, setNewQuantity] = useState('')
  const [newCost, setNewCost] = useState('')

  const [rowMenu, setRowMenu] = useState<number | null>(null)
  const [editDelivery, setEditDelivery] = useState<Delivery | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSupplier, setEditSupplier] = useState('')
  const [editQuantity, setEditQuantity] = useState('')
  const [editCost, setEditCost] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch('/api/deliveries/suppliers', { signal: controller.signal }),
      fetch('/api/dictionaries/categories', { signal: controller.signal }),
    ])
      .then(async ([supplierResponse, categoryResponse]) => {
        if (!supplierResponse.ok || !categoryResponse.ok) throw new Error('Dictionaries failed')
        const supplierPayload = await supplierResponse.json() as SuppliersResponse
        const categoryPayload = await categoryResponse.json() as CategoriesResponse
        setSuppliers(supplierPayload.items || [])
        setCategories(categoryPayload.items || [])
      })
      .catch((loadError) => {
        if ((loadError as Error).name !== 'AbortError') setError('Nie udało się pobrać filtrów dostaw.')
      })
    return () => controller.abort()
  }, [reloadKey])

  const filterParams = useMemo(() => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (supplier) params.set('supplier', supplier)
    if (status) params.set('status', status)
    if (category) params.set('category', category)
    if (debouncedQuery) params.set('search', debouncedQuery)
    return params
  }, [from, to, supplier, status, category, debouncedQuery])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    Promise.all([
      fetch(`/api/deliveries?${filterParams.toString()}`, { signal: controller.signal }),
      fetch(`/api/deliveries/summary?${filterParams.toString()}`, { signal: controller.signal }),
    ])
      .then(async ([listResponse, summaryResponse]) => {
        if (!listResponse.ok || !summaryResponse.ok) throw new Error('Deliveries failed')
        const listPayload = await listResponse.json() as DeliveryListResponse
        const summaryPayload = await summaryResponse.json() as DeliverySummaryResponse
        setDeliveries(listPayload.items || [])
        setSummary({
          activeDeliveries: summaryPayload.activeDeliveries || 0,
          receivedUnits: summaryPayload.receivedUnits || 0,
          sellThrough: summaryPayload.sellThrough || 0,
          sales: summaryPayload.sales || 0,
          profit: summaryPayload.profit || 0,
          bestSupplier: summaryPayload.bestSupplier || null,
        })
        setError('')
      })
      .catch((loadError) => {
        if ((loadError as Error).name !== 'AbortError') setError('Nie udało się pobrać danych dostaw.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [filterParams, reloadKey])

  const loadItems = async (deliveryNumber: number) => {
    if (itemsByDelivery[deliveryNumber] || itemLoading.has(deliveryNumber)) return
    setItemLoading((current) => new Set(current).add(deliveryNumber))
    try {
      const response = await fetch(`/api/deliveries/${deliveryNumber}/items`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Items failed')
      const payload = await response.json() as DeliveryItemsResponse
      setItemsByDelivery((current) => ({ ...current, [deliveryNumber]: payload.items || [] }))
    } catch {
      setItemsByDelivery((current) => ({ ...current, [deliveryNumber]: [] }))
    } finally {
      setItemLoading((current) => {
        const next = new Set(current)
        next.delete(deliveryNumber)
        return next
      })
    }
  }

  const toggleDelivery = async (deliveryNumber: number) => {
    if (expanded.has(deliveryNumber)) {
      setExpanded((current) => {
        const next = new Set(current)
        next.delete(deliveryNumber)
        return next
      })
      return
    }
    setExpanded((current) => new Set(current).add(deliveryNumber))
    await loadItems(deliveryNumber)
  }

  const sortedDeliveries = useMemo(() => {
    const direction = order === 'asc' ? 1 : -1
    return [...deliveries].sort((left, right) => {
      const leftValue = left[sort]
      const rightValue = right[sort]

      if (typeof leftValue === 'string' || typeof rightValue === 'string') {
        return String(leftValue).localeCompare(String(rightValue), 'pl-PL', { sensitivity: 'base' }) * direction
      }

      return (Number(leftValue) - Number(rightValue)) * direction
    })
  }, [deliveries, sort, order])

  const visibleNumbers = sortedDeliveries.map((delivery) => delivery.deliveryNumber)
  const allExpanded = visibleNumbers.length > 0 && visibleNumbers.every((number) => expanded.has(number))

  const toggleAll = async () => {
    if (!visibleNumbers.length) return
    if (allExpanded) {
      setExpanded((current) => {
        const next = new Set(current)
        visibleNumbers.forEach((number) => next.delete(number))
        return next
      })
      return
    }

    setExpanded((current) => {
      const next = new Set(current)
      visibleNumbers.forEach((number) => next.add(number))
      return next
    })
    await Promise.all(visibleNumbers.map((number) => loadItems(number)))
  }

  const applyDateRange = () => {
    if (draftFrom && draftTo && draftFrom > draftTo) return
    setFrom(draftFrom)
    setTo(draftTo)
    setDateOpen(false)
  }

  const clearDateRange = () => {
    setDraftFrom('')
    setDraftTo('')
    setFrom('')
    setTo('')
    setDateOpen(false)
  }

  const toggleSort = (nextSort: keyof Delivery) => {
    if (sort === nextSort) {
      setOrder((current) => current === 'desc' ? 'asc' : 'desc')
    } else {
      setSort(nextSort)
      setOrder('desc')
    }
  }

  const sortArrow = (column: keyof Delivery) => sort === column ? (order === 'desc' ? '↓' : '↑') : '↕'

  const showDetails = async (deliveryNumber: number) => {
    setRowMenu(null)
    setExpanded((current) => new Set(current).add(deliveryNumber))
    await loadItems(deliveryNumber)
  }

  const openEditDelivery = (delivery: Delivery) => {
    setRowMenu(null)
    setEditError('')
    setEditDelivery(delivery)
    setEditDate(delivery.deliveryDate)
    setEditSupplier(delivery.supplierName)
    setEditQuantity(String(delivery.quantity))
    setEditCost(String(delivery.totalCost))
  }

  const saveEditedDelivery = async (event: FormEvent) => {
    event.preventDefault()
    if (!editDelivery) return

    const quantity = Number(editQuantity.replace(',', '.'))
    const totalCost = Number(editCost.replace(',', '.'))
    if (!editDate || !editSupplier.trim() || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(totalCost) || totalCost < 0) {
      setEditError('Uzupełnij poprawnie datę, dostawcę, liczbę sztuk i koszt.')
      return
    }

    setEditSaving(true)
    setEditError('')
    try {
      const response = await fetch(`/api/deliveries/${editDelivery.deliveryNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryDate: editDate,
          supplierName: editSupplier.trim(),
          quantity,
          totalCost,
        }),
      })
      const payload = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się zapisać dostawy.')
      setEditDelivery(null)
      setReloadKey((value) => value + 1)
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : 'Nie udało się zapisać dostawy.')
    } finally {
      setEditSaving(false)
    }
  }

  const setDeliveryActive = async (delivery: Delivery, active: boolean) => {
    setRowMenu(null)
    try {
      const response = await fetch(`/api/deliveries/${delivery.deliveryNumber}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      })
      const payload = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się zmienić statusu dostawy.')
      setDeliveries((current) => current.map((entry) => (
        entry.deliveryNumber === delivery.deliveryNumber ? { ...entry, active } : entry
      )))
      setReloadKey((value) => value + 1)
    } catch (activeError) {
      setError(activeError instanceof Error ? activeError.message : 'Nie udało się zmienić statusu dostawy.')
    }
  }

  const deleteDelivery = async (delivery: Delivery) => {
    setRowMenu(null)
    if (delivery.deliveryNumber <= 0) {
      setError('Dostawy technicznej -1 lub 0 nie można usunąć.')
      return
    }
    if (!window.confirm(`Usunąć dostawę nr ${delivery.deliveryNumber} — ${delivery.supplierName}? Tej operacji nie można cofnąć.`)) return

    try {
      const response = await fetch(`/api/deliveries/${delivery.deliveryNumber}`, { method: 'DELETE' })
      const payload = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się usunąć dostawy.')
      setExpanded((current) => {
        const next = new Set(current)
        next.delete(delivery.deliveryNumber)
        return next
      })
      setItemsByDelivery((current) => {
        const next = { ...current }
        delete next[delivery.deliveryNumber]
        return next
      })
      setReloadKey((value) => value + 1)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć dostawy.')
    }
  }

  const submitDelivery = async (event: FormEvent) => {
    event.preventDefault()
    setAddError('')
    const quantity = Number(newQuantity.replace(',', '.'))
    const totalCost = Number(newCost.replace(',', '.'))
    if (!newDate || !newSupplier.trim() || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(totalCost) || totalCost < 0) {
      setAddError('Uzupełnij poprawnie datę, dostawcę, liczbę sztuk i koszt.')
      return
    }

    setAddSaving(true)
    try {
      const response = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryDate: newDate,
          supplierName: newSupplier.trim(),
          quantity,
          totalCost,
        }),
      })
      const payload = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Nie udało się dodać dostawy.')
      setAddOpen(false)
      setNewDate(localYmd())
      setNewSupplier('')
      setNewQuantity('')
      setNewCost('')
      setReloadKey((value) => value + 1)
    } catch (saveError) {
      setAddError(saveError instanceof Error ? saveError.message : 'Nie udało się dodać dostawy.')
    } finally {
      setAddSaving(false)
    }
  }

  const kpis = [
    ['Aktywne dostawy', formatNumber(summary.activeDeliveries), '▣', 'green'],
    ['Sztuk przyjęto', formatNumber(summary.receivedUnits), '◇', 'gold'],
    ['% zbytu', formatPercent(summary.sellThrough), '↗', 'green'],
    ['Sprzedaż z dostaw', formatMoney(summary.sales), '▥', 'green'],
    ['Szacowany zysk', formatMoney(summary.profit), '◉', 'gold'],
    ['Najlepszy dostawca', summary.bestSupplier || '—', '♧', 'rose'],
  ] as const

  return (
    <div className="deliveries-wrap">
      <DeliveriesHeader />

      <section className="deliveries-kpi-grid">
        {kpis.map(([label, value, icon, tone]) => (
          <article className={`deliveries-kpi-card ${loading ? 'is-loading' : ''}`} key={label}>
            <i className={`deliveries-kpi-icon ${tone}`}>{icon}</i>
            <div><span>{label}</span><strong>{value}</strong></div>
          </article>
        ))}
      </section>

      <section className="sales-filters deliveries-filters" aria-label="Filtry dostaw">
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
              {from || to ? `${from ? displayYmd(from) : '…'} — ${to ? displayYmd(to) : '…'}` : 'Wszystkie daty'} <i>⌄</i>
            </button>
          </span>
          {dateOpen && (
            <div className="sales-date-popover">
              <div className="sales-date-fields">
                <label><span>Od</span><input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} /></label>
                <label><span>Do</span><input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} /></label>
              </div>
              {draftFrom && draftTo && draftFrom > draftTo && <small className="sales-date-error">Data „od” nie może być późniejsza niż „do”.</small>}
              <div className="sales-date-actions">
                <button type="button" className="secondary" onClick={clearDateRange}>Wszystkie daty</button>
                <button type="button" className="primary" disabled={Boolean(draftFrom && draftTo && draftFrom > draftTo)} onClick={applyDateRange}>Zastosuj</button>
              </div>
            </div>
          )}
        </div>

        <label className="sales-filter">
          <span className="sales-filter-icon blue">♧</span>
          <span className="sales-filter-copy">
            <small>Dostawca</small>
            <select value={supplier} onChange={(event) => setSupplier(event.target.value)}>
              <option value="">Wszyscy</option>
              {suppliers.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </span>
        </label>

        <label className="sales-filter">
          <span className="sales-filter-icon green">↗</span>
          <span className="sales-filter-copy">
            <small>Status</small>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Wszystkie</option>
              <option value="active">Aktywne</option>
              <option value="inactive">Nieaktywne</option>
              <option value="unsold">Bez sprzedaży</option>
              <option value="sold-out">Wyprzedane</option>
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

        <label className="sales-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj Lp. dostawy lub dostawcy..."
          />
          {query && <button type="button" aria-label="Wyczyść wyszukiwanie" onClick={() => setQuery('')}>×</button>}
        </label>
      </section>

      {error && (
        <div className="deliveries-error">
          <span>{error}</span>
          <button onClick={() => setReloadKey((value) => value + 1)}>Spróbuj ponownie</button>
        </div>
      )}

      <section className="deliveries-table-card">
        <div className="deliveries-table-toolbar">
          <div className="deliveries-table-title">
            <h2>Dostawy</h2>
            <span>{deliveries.length} pozycji</span>
          </div>
          <div className="deliveries-table-actions">
            <button type="button" className="deliveries-add" onClick={() => setAddOpen(true)}>＋ Dodaj dostawę</button>
          </div>
        </div>

        <div className="deliveries-table-scroll">
          <div className="deliveries-table">
            <div className="deliveries-grid deliveries-table-head">
              <button
                type="button"
                className="sales-expand-all"
                disabled={loading || sortedDeliveries.length === 0}
                aria-label={allExpanded ? 'Zwiń wszystkie dostawy' : 'Rozwiń wszystkie dostawy'}
                title={allExpanded ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'}
                aria-pressed={allExpanded}
                onClick={() => void toggleAll()}
              >
                {allExpanded ? '⊟' : '⊞'}
              </button>
              <button type="button" className="deliveries-sort" onClick={() => toggleSort('deliveryNumber')}>Lp. <b>{sortArrow('deliveryNumber')}</b></button>
              <button type="button" className="deliveries-sort" onClick={() => toggleSort('deliveryDate')}>Data <b>{sortArrow('deliveryDate')}</b></button>
              <button type="button" className="deliveries-sort" onClick={() => toggleSort('supplierName')}>Dostawca <b>{sortArrow('supplierName')}</b></button>
              <button type="button" className="deliveries-sort deliveries-sort-center" onClick={() => toggleSort('active')}>Aktywna <b>{sortArrow('active')}</b></button>
              <button type="button" className="deliveries-sort" onClick={() => toggleSort('totalCost')}>Koszt zakupu <b>{sortArrow('totalCost')}</b></button>
              <button type="button" className="deliveries-sort" onClick={() => toggleSort('quantity')}>Ilość <b>{sortArrow('quantity')}</b></button>
              <button type="button" className="deliveries-sort" onClick={() => toggleSort('unitCost')}>Cena/szt. <b>{sortArrow('unitCost')}</b></button>
              <button type="button" className="deliveries-sort" onClick={() => toggleSort('sold')}>Sprzedane <b>{sortArrow('sold')}</b></button>
              <button type="button" className="deliveries-sort" onClick={() => toggleSort('sellThrough')}>% zbytu <b>{sortArrow('sellThrough')}</b></button>
              <button type="button" className="deliveries-sort" onClick={() => toggleSort('returnRate')}>% zwrotu <b>{sortArrow('returnRate')}</b></button>
              <button type="button" className="deliveries-sort" onClick={() => toggleSort('sales')}>Sprzedaż <b>{sortArrow('sales')}</b></button>
              <button type="button" className="deliveries-sort" onClick={() => toggleSort('profit')}>Zysk <b>{sortArrow('profit')}</b></button>
              <span className="deliveries-menu-dots">⋮</span>
            </div>

            {loading && <div className="deliveries-empty">Ładowanie dostaw…</div>}
            {!loading && deliveries.length === 0 && <div className="deliveries-empty">Brak dostaw dla wybranych filtrów.</div>}

            {!loading && sortedDeliveries.map((delivery, index) => {
              const isExpanded = expanded.has(delivery.deliveryNumber)
              const items = itemsByDelivery[delivery.deliveryNumber] || []
              return (
                <div className={`delivery-group ${index % 2 ? 'alt' : ''} ${isExpanded ? 'expanded' : ''}`} key={delivery.deliveryNumber}>
                  <div className="deliveries-grid delivery-row">
                    <button className="delivery-expand" onClick={() => void toggleDelivery(delivery.deliveryNumber)} aria-label={isExpanded ? 'Zwiń dostawę' : 'Rozwiń dostawę'}>{isExpanded ? '−' : '+'}</button>
                    <strong>{delivery.deliveryNumber}</strong>
                    <span>{displayYmd(delivery.deliveryDate)}</span>
                    <span className="delivery-supplier">{delivery.supplierName}</span>
                    <span className="delivery-active-cell">
                      <input
                        type="checkbox"
                        checked={delivery.active}
                        readOnly
                        tabIndex={-1}
                        aria-label={delivery.active ? 'Dostawa aktywna' : 'Dostawa nieaktywna'}
                      />
                    </span>
                    <span>{formatMoney(delivery.totalCost)}</span>
                    <span>{formatNumber(delivery.quantity)}</span>
                    <span>{formatMoney(delivery.unitCost)}</span>
                    <span>{formatNumber(delivery.sold)}</span>
                    <span>{formatPercent(delivery.sellThrough)}</span>
                    <span className={delivery.returnRate >= 100 ? 'metric-positive' : delivery.returnRate < 50 ? 'metric-negative' : ''}>{formatPercent(delivery.returnRate)}</span>
                    <span>{formatMoney(delivery.sales)}</span>
                    <span className={delivery.profit >= 0 ? 'metric-positive' : 'metric-negative'}>{formatMoney(delivery.profit)}</span>
                    <button
                      type="button"
                      className="delivery-row-menu"
                      aria-label={`Menu dostawy ${delivery.deliveryNumber}`}
                      aria-expanded={rowMenu === delivery.deliveryNumber}
                      onClick={() => setRowMenu((current) => current === delivery.deliveryNumber ? null : delivery.deliveryNumber)}
                    >
                      •••
                    </button>
                  </div>

                  {rowMenu === delivery.deliveryNumber && (
                    <div className="delivery-row-actions" role="menu" aria-label={`Akcje dostawy ${delivery.deliveryNumber}`}>
                      <button type="button" role="menuitem" onClick={() => void showDetails(delivery.deliveryNumber)}>Szczegóły</button>
                      <button type="button" role="menuitem" onClick={() => openEditDelivery(delivery)}>Edytuj dostawę</button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void setDeliveryActive(delivery, !delivery.active)}
                      >
                        {delivery.active ? 'Deaktywuj' : 'Aktywuj'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="danger"
                        disabled={delivery.deliveryNumber <= 0}
                        title={delivery.deliveryNumber <= 0 ? 'Dostaw technicznych nie można usuwać' : undefined}
                        onClick={() => void deleteDelivery(delivery)}
                      >
                        Usuń dostawę
                      </button>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="delivery-items-wrap">
                      <div className="delivery-items-table">
                        <div className="delivery-items-grid delivery-items-head"><span>Artykuł</span><span>Kategoria</span><span>Sprzedane szt.</span><span>Sprzedaż</span></div>
                        {itemLoading.has(delivery.deliveryNumber)
                          ? <div className="delivery-items-empty">Ładowanie sprzedanych artykułów…</div>
                          : items.length
                            ? items.map((item, itemIndex) => (
                              <div className={`delivery-items-grid delivery-item-row ${itemIndex % 2 ? 'alt' : ''}`} key={`${item.itemId || item.itemName}-${item.category}`}>
                                <strong>{item.itemName}</strong>
                                <span>{item.category}</span>
                                <span>{formatNumber(item.quantity)} szt.</span>
                                <span>{formatMoney(item.sales)}</span>
                              </div>
                            ))
                            : <div className="delivery-items-empty">Brak sprzedanych artykułów z tej dostawy.</div>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {editDelivery && (
        <div className="delivery-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !editSaving) setEditDelivery(null) }}>
          <section className="delivery-modal" role="dialog" aria-modal="true" aria-labelledby="edit-delivery-title">
            <div className="delivery-modal-head">
              <div><span>Dostawa nr {editDelivery.deliveryNumber}</span><h2 id="edit-delivery-title">Edytuj dostawę</h2></div>
              <button type="button" onClick={() => setEditDelivery(null)} disabled={editSaving} aria-label="Zamknij">×</button>
            </div>
            <form onSubmit={saveEditedDelivery}>
              <label><span>Data dostawy</span><input type="date" required value={editDate} onChange={(event) => setEditDate(event.target.value)} /></label>
              <label><span>Dostawca</span><input required list="delivery-suppliers-edit" value={editSupplier} onChange={(event) => setEditSupplier(event.target.value)} /><datalist id="delivery-suppliers-edit">{suppliers.map((entry) => <option value={entry} key={entry} />)}</datalist></label>
              <div className="delivery-form-pair">
                <label><span>Ilość sztuk</span><input type="number" min="1" step="1" required value={editQuantity} onChange={(event) => setEditQuantity(event.target.value)} /></label>
                <label><span>Koszt zakupu dostawy</span><input type="number" min="0" step="0.01" required value={editCost} onChange={(event) => setEditCost(event.target.value)} /></label>
              </div>
              {editError && <div className="delivery-form-error">{editError}</div>}
              <div className="delivery-modal-actions">
                <button type="button" className="secondary" disabled={editSaving} onClick={() => setEditDelivery(null)}>Anuluj</button>
                <button type="submit" className="primary" disabled={editSaving}>{editSaving ? 'Zapisywanie…' : 'Zapisz zmiany'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {addOpen && (
        <div className="delivery-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !addSaving) setAddOpen(false) }}>
          <section className="delivery-modal" role="dialog" aria-modal="true" aria-labelledby="add-delivery-title">
            <div className="delivery-modal-head">
              <div><span>Nowa dostawa</span><h2 id="add-delivery-title">Dodaj dostawę</h2></div>
              <button type="button" onClick={() => setAddOpen(false)} disabled={addSaving} aria-label="Zamknij">×</button>
            </div>
            <form onSubmit={submitDelivery}>
              <label><span>Data dostawy</span><input type="date" required value={newDate} onChange={(event) => setNewDate(event.target.value)} /></label>
              <label><span>Dostawca</span><input required list="delivery-suppliers" value={newSupplier} onChange={(event) => setNewSupplier(event.target.value)} placeholder="Nazwa dostawcy" /><datalist id="delivery-suppliers">{suppliers.map((entry) => <option value={entry} key={entry} />)}</datalist></label>
              <div className="delivery-form-pair">
                <label><span>Ilość sztuk</span><input type="number" min="1" step="1" required value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} /></label>
                <label><span>Łączny koszt</span><input type="number" min="0" step="0.01" required value={newCost} onChange={(event) => setNewCost(event.target.value)} /></label>
              </div>
              {addError && <div className="delivery-form-error">{addError}</div>}
              <div className="delivery-modal-actions">
                <button type="button" className="secondary" disabled={addSaving} onClick={() => setAddOpen(false)}>Anuluj</button>
                <button type="submit" className="primary" disabled={addSaving}>{addSaving ? 'Zapisywanie…' : 'Dodaj dostawę'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
