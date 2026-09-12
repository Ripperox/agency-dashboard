import { useSearchParams } from 'react-router-dom'
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../utils/format'

// everything lives in the url so a filtered view can be shared as a link
export default function TaskFilters() {
  const [params, setParams] = useSearchParams()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const active = ['status', 'priority', 'dueFrom', 'dueTo', 'overdue'].some((k) => params.get(k))

  return (
    <div className="filters">
      <select value={params.get('status') ?? ''} onChange={(e) => update('status', e.target.value)}>
        <option value="">Any status</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <select value={params.get('priority') ?? ''} onChange={(e) => update('priority', e.target.value)}>
        <option value="">Any priority</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </select>
      <label className="filter-date">
        Due from
        <input type="date" value={params.get('dueFrom') ?? ''} onChange={(e) => update('dueFrom', e.target.value)} />
      </label>
      <label className="filter-date">
        to
        <input type="date" value={params.get('dueTo') ?? ''} onChange={(e) => update('dueTo', e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={params.get('overdue') === 'true'} onChange={(e) => update('overdue', e.target.checked ? 'true' : '')} />
        Overdue only
      </label>
      {active && (
        <button className="link-btn" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
          Clear
        </button>
      )}
    </div>
  )
}
