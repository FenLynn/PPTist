export interface AIModelOption {
  label: string
  value: string
}

interface DashboardAIModel {
  id?: string
  name?: string
  provider?: string
}

const FALLBACK_MODELS: AIModelOption[] = [
  { label: 'Gemini 3.1 Flash', value: 'gemini-3.1-flash-lite-preview' },
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 3.0 Flash', value: 'gemini-3-flash-preview' },
]

function normalizeModelId(value: unknown) {
  return String(value || '').trim()
}

function normalizeLabelFromId(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map(part => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function parseDashboardModels(raw: string | null) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as DashboardAIModel[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(item => {
        const value = normalizeModelId(item?.id)
        if (!value || value.startsWith('@cf/')) return null
        const name = String(item?.name || '').trim()
        const provider = String(item?.provider || '').trim()
        const label = name || normalizeLabelFromId(value)
        return {
          value,
          label: provider ? `${label} (${provider})` : label,
        }
      })
      .filter((item): item is AIModelOption => !!item)
  } catch {
    return []
  }
}

export function resolveAIModelConfig(search = window.location.search) {
  const params = new URLSearchParams(search)
  const dashboardModels = parseDashboardModels(params.get('aiModels'))
  const options = dashboardModels.length ? dashboardModels : FALLBACK_MODELS.slice()
  const requestedDefault = normalizeModelId(params.get('aiModel'))
  const fallbackDefault = options[0]?.value || ''
  const defaultModel = options.some(option => option.value === requestedDefault) ? requestedDefault : fallbackDefault

  return {
    aiModels: options,
    aiModel: defaultModel,
  }
}