export interface PptistCloudFilePayload {
  filename: string
  overwrite?: boolean
  content: string
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String((data as { error?: string }).error || `HTTP ${response.status}`))
  }
  return data
}

export async function listCloudFiles() {
  const response = await fetch('/api/pptist/list')
  const data = await parseResponse(response) as { files?: string[] }
  return Array.isArray(data.files) ? data.files : []
}

export async function loadCloudFile(filename: string) {
  const response = await fetch(`/api/pptist/load?filename=${encodeURIComponent(filename)}`)
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
  const response = await fetch('/api/pptist/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  })
  return parseResponse(response) as Promise<{ success: boolean; filename: string }>
}