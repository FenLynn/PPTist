export interface AIModelOption {
  label: string
  value: string
}

interface DashboardAIModel {
  id?: string
  name?: string
  provider?: string
}

const REQUIRED_MODELS: AIModelOption[] = [
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  { label: 'GLM-4.7-Flash', value: 'glm-4.7-flash' },
  { label: 'Doubao-Seed-1.6-Flash', value: 'doubao-seed-1.6-flash' },
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
  const merged = new Map<string, AIModelOption>()

  for (const option of dashboardModels) merged.set(option.value, option)
  for (const option of REQUIRED_MODELS) {
    if (!merged.has(option.value)) merged.set(option.value, option)
  }

  const options = Array.from(merged.values())
  const requestedDefault = normalizeModelId(params.get('aiModel'))
  const fallbackDefault = options.find(option => option.value === 'gemini-2.5-flash')?.value || options[0]?.value || ''
  const defaultModel = options.some(option => option.value === requestedDefault) ? requestedDefault : fallbackDefault

  return {
    aiModels: options,
    aiModel: defaultModel,
  }
}