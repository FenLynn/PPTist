export interface PptistCloudFilePayload {
  filename: string
  overwrite?: boolean
  content: string
  kind?: 'file' | 'template'
}

type CloudKind = 'file' | 'template'

function buildKindQuery(kind: CloudKind = 'file') {
  return kind === 'template' ? '?kind=template' : ''
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String((data as { error?: string }).error || `HTTP ${response.status}`))
  }
  return data
}

export async function listCloudFiles(kind: CloudKind = 'file') {
  const response = await fetch(`/api/pptist/list${buildKindQuery(kind)}`)
  const data = await parseResponse(response) as { files?: string[] }
  return Array.isArray(data.files) ? data.files : []
}

export async function loadCloudFile(filename: string, kind: CloudKind = 'file') {
  const join = kind === 'template' ? '&kind=template' : ''
  const response = await fetch(`/api/pptist/load?filename=${encodeURIComponent(filename)}${join}`)
  return parseResponse(response) as Promise<{ success: boolean; filename: string; content: string }>
}

export async function saveCloudFile(payload: PptistCloudFilePayload) {
  const response = await fetch('/api/pptist/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseResponse(response) as Promise<{ success: boolean; filename: string }>
}

export async function deleteCloudFile(filename: string) {
  return deleteCloudFileByKind(filename, 'file')
}

export async function deleteCloudFileByKind(filename: string, kind: CloudKind = 'file') {
  const response = await fetch('/api/pptist/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, kind }),
  })
  return parseResponse(response) as Promise<{ success: boolean; filename: string }>
}

export async function renameCloudFile(filename: string, nextFilename: string, kind: CloudKind = 'file') {
  const response = await fetch('/api/pptist/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, nextFilename, kind }),
  })
  return parseResponse(response) as Promise<{ success: boolean; filename: string; nextFilename: string }>
}