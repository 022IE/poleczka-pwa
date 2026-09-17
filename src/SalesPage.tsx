import { useMemo, useState } from 'react'
import BuildStatus from './components/BuildStatus'

const SHOW_DEV_PIPELINE = true

type Payment = 'Gotówka' | 'Karta' | 'BLIK'

type SaleLine = {
  item: string
  category: string
  sku: string
  quantity: number
  price: string
  discount: string
  net: string
  delivery: number
  tone: 'rose' | 'green' | 'gold' | 'blue'
}

type Receipt = {
  number: string
  date: string
  positions: number
  units: number
  gross: string
  discount: string
  net: string
  payment: Payment
  lines?: SaleLine[]
}

const salesKpis = [
  ['Paragony', '48', '▤', 'green'],
  ['Sprzedane sztuki', '102', '◇', 'gold'],
  ['Sprzedaż brutto', '4 334,62 zł', '▥', 'green'],
  ['Rabaty', '365,88 zł', '%', 'rose'],
  ['Sprzedaż netto', '3 968,74 zł', '▣', 'green'],
  ['Średni paragon', '82,68 zł', '◇', 'gold'],
] as const

const receipts: Receipt[] = [
  {
    number: '2-0048', date: '15.09.2026', positions: 3, units: 5, gross: '214,00 zł', discount: '14,00 zł', net: '200,00 zł', payment: 'Gotówka',
    lines: [
      { item: 'Bluzka lniana', category: 'GÓRA', sku: 'BLU-019', quantity: 2, price: '49,00 zł', discount: '4,00 zł', net: '94,00 zł', delivery: 1, tone: 'rose' },
      { item: 'Spódnica', category: 'DÓŁ', sku: 'SPD-112', quantity: 2, price: '38,00 zł', discount: '0,00 zł', net: '76,00 zł', delivery: 2, tone: 'green' },
      { item: 'Apaszka', category: 'AKCESORIA', sku: 'APS-031', quantity: 1, price: '30,00 zł', discount: '0,00 zł', net: '30,00 zł', delivery: 0, tone: 'gold' },
    ],
  },
  {
    number: '2-0047', date: '14.09.2026', positions: 2, units: 2, gross: '95,00 zł', discount: '0,00 zł', net: '95,00 zł', payment: 'Karta',
    lines: [
      { item: 'Sweter', category: 'GÓRA', sku: 'SWE-044', quantity: 1, price: '55,00 zł', discount: '0,00 zł', net: '55,00 zł', delivery: 3, tone: 'green' },
      { item: 'Pasek', category: 'AKCESORIA', sku: 'PAS-017', quantity: 1, price: '40,00 zł', discount: '0,00 zł', net: '40,00 zł', delivery: 2, tone: 'gold' },
    ],
  },
  {
    number: '2-0046', date: '13.09.2026', positions: 4, units: 4, gross: '180,50 zł', discount: '10,50 zł', net: '170,00 zł', payment: 'BLIK',
    lines: [
      { item: 'Koszula', category: 'GÓRA', sku: 'KOS-065', quantity: 1, price: '52,00 zł', discount: '2,00 zł', net: '50,00 zł', delivery: 4, tone: 'blue' },
      { item: 'Spodnie', category: 'DÓŁ', sku: 'SPD-118', quantity: 1, price: '64,50 zł', discount: '4,50 zł', net: '60,00 zł', delivery: 4, tone: 'green' },
      { item: 'Torebka', category: 'AKCESORIA', sku: 'TOR-007', quantity: 1, price: '39,00 zł', discount: '4,00 zł', net: '35,00 zł', delivery: 1, tone: 'gold' },
      { item: 'Broszka', category: 'AKCESORIA', sku: 'BRO-021', quantity: 1, price: '25,00 zł', discount: '0,00 zł', net: '25,00 zł', delivery: 0, tone: 'rose' },
    ],
  },
  {
    number: '2-0025', date: '12.09.2026', positions: 3, units: 3, gross: '203,00 zł', discount: '14,00 zł', net: '189,00 zł', payment: 'Karta',
    lines: [
      { item: 'Bluzka', category: 'GÓRA', sku: 'BLU-019', quantity: 1, price: '49,00 zł', discount: '4,00 zł', net: '45,00 zł', delivery: 1, tone: 'rose' },
      { item: 'Spódnica', category: 'DÓŁ', sku: 'SPD-112', quantity: 1, price: '65,00 zł', discount: '0,00 zł', net: '65,00 zł', delivery: 2, tone: 'green' },
      { item: 'Torebka', category: 'AKCESORIA', sku: 'TOR-008', quantity: 1, price: '89,00 zł', discount: '10,00 zł', net: '79,00 zł', delivery: 0, tone: 'gold' },
    ],
  },
  { number: '2-0024', date: '11.09.2026', positions: 1, units: 1, gross: '79,00 zł', discount: '0,00 zł', net: '79,00 zł', payment: 'Gotówka' },
  { number: '2-0023', date: '10.09.2026', positions: 3, units: 4, gross: '267,50 zł', discount: '22,50 zł', net: '245,00 zł', payment: 'Karta' },
  { number: '2-0022', date: '09.09.2026', positions: 2, units: 3, gross: '150,00 zł', discount: '15,00 zł', net: '135,00 zł', payment: 'BLIK' },
  { number: '2-0021', date: '08.09.2026', positions: 4, units: 6, gross: '320,00 zł', discount: '30,00 zł', net: '290,00 zł', payment: 'Karta' },
]

const categories = ['Wszystkie', 'GÓRA', 'DÓŁ', 'AKCESORIA']
const items = ['Wszystkie', 'Bluzka', 'Spódnica', 'Torebka', 'Sweter', 'Koszula', 'Spodnie']

function PaymentBadge({ payment }: { payment: Payment }) {
  const symbol = payment === 'Gotówka' ? '▣' : payment === 'Karta' ? '▭' : '▯'
  return <span className={`sales-payment ${payment.toLowerCase()}`}><i>{symbol}</i>{payment}</span>
}

function SalesHeader() {
  const now = new Date()
  const weekday = new Intl.DateTimeFormat('pl-PL', { weekday: 'long' }).format(now)
  const date = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(now)

  return (
    <header className="dashboard-header sales-header">
      <div>
        <h1>Sprzedaż</h1>
        <p>Tu znajdziesz wszystkie paragony i szczegóły sprzedaży.</p>
      </div>
      {SHOW_DEV_PIPELINE && <div className="header-build-slot"><BuildStatus /></div>}
      <div className="header-actions">
        <div className="date-block"><span className="header-icon">▣</span><div><b>{weekday}</b><span>{date}</span></div></div>
        <div className="header-divider" />
        <button className="bell" aria-label="Powiadomienia">♟<span>3</span></button>
        <div className="sync-pill"><b>↻</b><div><strong>Zsynchronizowano</strong><small>Dzisiaj, 10:24</small></div><i /></div>
        <div className="avatar">I</div>
      </div>
    </header>
  )
}

function SalesPage() {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['2-0025']))
  const [payment, setPayment] = useState('Wszystkie')
  const [category, setCategory] = useState('Wszystkie')
  const [item, setItem] = useState('Wszystkie')
  const [query, setQuery] = useState('')

  const filteredReceipts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pl-PL')

    return receipts.filter((receipt) => {
      if (payment !== 'Wszystkie' && receipt.payment !== payment) return false

      const lines = receipt.lines ?? []
      if (category !== 'Wszystkie' && !lines.some((line) => line.category === category)) return false
      if (item !== 'Wszystkie' && !lines.some((line) => line.item === item || line.item.startsWith(item))) return false

      if (!normalizedQuery) return true
      if (receipt.number.toLocaleLowerCase('pl-PL').includes(normalizedQuery)) return true
      return lines.some((line) => `${line.item} ${line.sku}`.toLocaleLowerCase('pl-PL').includes(normalizedQuery))
    })
  }, [payment, category, item, query])

  const toggleReceipt = (number: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(number)) next.delete(number)
      else next.add(number)
      return next
    })
  }

  return (
    <div className="sales-wrap">
      <SalesHeader />

      <section className="sales-kpi-grid" aria-label="Podsumowanie sprzedaży">
        {salesKpis.map(([label, value, icon, tone]) => (
          <article className="sales-kpi-card" key={label}>
            <span className={`sales-kpi-icon ${tone}`}>{icon}</span>
            <div><span>{label}</span><strong>{value}</strong></div>
          </article>
        ))}
      </section>

      <section className="sales-filters" aria-label="Filtry sprzedaży">
        <label className="sales-filter sales-filter-date">
          <span className="sales-filter-icon gold">▣</span>
          <span className="sales-filter-copy"><small>Zakres dat</small><button type="button">01.09.2026 <b>—</b> 30.09.2026 <i>⌄</i></button></span>
        </label>

        <label className="sales-filter">
          <span className="sales-filter-icon blue">▭</span>
          <span className="sales-filter-copy"><small>Płatności</small><select value={payment} onChange={(event) => setPayment(event.target.value)}><option>Wszystkie</option><option>Gotówka</option><option>Karta</option><option>BLIK</option></select></span>
        </label>

        <label className="sales-filter">
          <span className="sales-filter-icon gold">◇</span>
          <span className="sales-filter-copy"><small>Kategoria</small><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></span>
        </label>

        <label className="sales-filter">
          <span className="sales-filter-icon green">♧</span>
          <span className="sales-filter-copy"><small>Artykuł</small><select value={item} onChange={(event) => setItem(event.target.value)}>{items.map((value) => <option key={value}>{value}</option>)}</select></span>
        </label>

        <label className="sales-search">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj paragonu, artykułu..." />
          {query && <button type="button" aria-label="Wyczyść wyszukiwanie" onClick={() => setQuery('')}>×</button>}
        </label>
      </section>

      <section className="sales-table-card">
        <div className="sales-table-scroll">
          <div className="sales-table" role="table" aria-label="Paragony">
            <div className="sales-table-head sales-table-grid" role="row">
              <span />
              <span>Paragon</span>
              <span className="sales-sort">Data <b>⌄</b></span>
              <span>Pozycji</span>
              <span>Szt.</span>
              <span>Brutto</span>
              <span>Rabat</span>
              <span>Netto</span>
              <span>Płatność</span>
              <span className="sales-menu-dots">⋮</span>
            </div>

            {filteredReceipts.length === 0 && <div className="sales-empty">Brak sprzedaży dla wybranych filtrów.</div>}

            {filteredReceipts.map((receipt, receiptIndex) => {
              const isExpanded = expanded.has(receipt.number)
              return (
                <div className={`sales-receipt-group ${receiptIndex % 2 ? 'alt' : ''} ${isExpanded ? 'expanded' : ''}`} key={receipt.number}>
                  <div className="sales-receipt-row sales-table-grid" role="row">
                    <button type="button" className="sales-expand" onClick={() => toggleReceipt(receipt.number)} aria-label={`${isExpanded ? 'Zwiń' : 'Rozwiń'} paragon ${receipt.number}`}>{isExpanded ? '−' : '+'}</button>
                    <strong>{receipt.number}</strong>
                    <span>{receipt.date}</span>
                    <span>{receipt.positions} {receipt.positions === 1 ? 'pozycja' : 'pozycje'}</span>
                    <span>{receipt.units}</span>
                    <span>{receipt.gross}</span>
                    <span>{receipt.discount}</span>
                    <strong>{receipt.net}</strong>
                    <PaymentBadge payment={receipt.payment} />
                    <button type="button" className="sales-row-menu" aria-label={`Menu paragonu ${receipt.number}`}>•••</button>
                  </div>

                  {isExpanded && (
                    <div className="sales-lines-wrap">
                      {receipt.lines?.length ? (
                        <div className="sales-lines-table">
                          <div className="sales-lines-head sales-lines-grid"><span>Artykuł</span><span>Kategoria</span><span>SKU</span><span>Ilość</span><span>Cena</span><span>Rabat</span><span>Netto</span><span>Lp. dostawy</span></div>
                          {receipt.lines.map((line, lineIndex) => (
                            <div className={`sales-line sales-lines-grid ${lineIndex % 2 ? 'alt' : ''}`} key={`${receipt.number}-${line.sku}`}>
                              <span className="sales-line-name"><i className={`sales-dot ${line.tone}`} />{line.item}</span>
                              <span className="sales-line-category"><i className={`sales-dot soft-${line.tone}`} />{line.category}</span>
                              <span>{line.sku}</span>
                              <span>{line.quantity}</span>
                              <span>{line.price}</span>
                              <span>{line.discount}</span>
                              <strong>{line.net}</strong>
                              <span>{line.delivery}</span>
                            </div>
                          ))}
                        </div>
                      ) : <div className="sales-lines-empty">Brak danych pozycji w makiecie tego paragonu.</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <footer className="sales-footer">
        <div className="sales-hint"><i>i</i><span>Kliknij w <b>+</b>, aby rozwinąć paragon i zobaczyć jego pozycje.</span></div>
        <nav className="sales-pagination" aria-label="Paginacja sprzedaży">
          <button type="button" aria-label="Poprzednia strona">‹</button>
          <button type="button" className="active">1</button>
          <button type="button">2</button>
          <button type="button">3</button>
          <button type="button">4</button>
          <button type="button">5</button>
          <span>…</span>
          <button type="button">7</button>
          <button type="button" aria-label="Następna strona">›</button>
        </nav>
      </footer>
    </div>
  )
}

export default SalesPage
