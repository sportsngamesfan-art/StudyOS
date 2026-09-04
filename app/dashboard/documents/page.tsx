'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants'
import type { DocumentRow } from '@/lib/types'
import { Alert, Button, Card, EmptyState, PageHeader, PageSpinner, Spinner } from '@/components/ui'

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
}

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

export default function DocumentsPage() {
  const user = useUser()
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const loadDocuments = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      setDocuments((data as DocumentRow[]) ?? [])
    } catch (err) {
      console.error('Error loading documents:', err)
      setError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
        throw new Error('Only PDF and image files are allowed')
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('File is larger than the 10MB limit')
      }

      const filePath = `${user.id}/${Date.now()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)
      if (uploadError) throw uploadError

      const { error: dbError } = await supabase.from('documents').insert({
        user_id: user.id,
        filename: file.name,
        file_path: filePath,
        file_size: file.size,
      })
      if (dbError) {
        // Don't leave an orphaned object behind if the row failed.
        await supabase.storage.from('documents').remove([filePath])
        throw dbError
      }

      setSuccess(`${file.name} uploaded`)
      await loadDocuments()
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  /**
   * The bucket is private, so files are opened through a short-lived signed
   * URL. The tab is opened synchronously and pointed at the URL afterwards,
   * because a `window.open` that happens after an await is popup-blocked.
   */
  const handleOpen = async (doc: DocumentRow) => {
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    setOpeningId(doc.id)
    setError('')
    try {
      const { data, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 60)
      if (urlError || !data?.signedUrl) throw urlError ?? new Error('No URL returned')
      if (tab) tab.location.href = data.signedUrl
      else window.location.assign(data.signedUrl)
    } catch (err) {
      console.error('Open error:', err)
      tab?.close()
      setError('Could not open that file')
    } finally {
      setOpeningId(null)
    }
  }

  const handleDelete = async (doc: DocumentRow) => {
    if (!confirm(`Delete ${doc.filename}?`)) return
    setError('')
    setSuccess('')
    try {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path])
      if (storageError) throw storageError

      const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id)
      if (dbError) throw dbError

      setSuccess(`${doc.filename} deleted`)
      await loadDocuments()
    } catch (err) {
      console.error('Delete error:', err)
      setError('Failed to delete document')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" subtitle="Upload and manage your study materials" />

      <Card padding="lg" className="border-2 border-dashed border-primary/40 text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center">
          <UploadIcon />
        </div>
        <h2 className="text-lg font-semibold text-ink mb-1">Upload a document</h2>
        <p className="text-muted text-sm mb-4">PDF and image files, up to 10MB</p>
        <input
          ref={fileInput}
          type="file"
          onChange={handleFileUpload}
          disabled={uploading}
          accept=".pdf,image/*"
          className="sr-only"
          id="file-upload"
        />
        <Button
          loading={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? 'Uploading…' : 'Choose file'}
        </Button>
      </Card>

      {error && (
        <Alert variant="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onDismiss={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {loading ? (
        <PageSpinner />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<FileIcon />}
          title="No documents yet"
          description="Lecture notes, past papers and worksheets you upload are kept private to your account."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-line">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink">Filename</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink">Size</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink">Uploaded</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-ink">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-surface-hover transition-colors duration-theme">
                    <td className="px-6 py-4 text-sm text-ink max-w-xs truncate">{doc.filename}</td>
                    <td className="px-6 py-4 text-sm text-muted whitespace-nowrap">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted whitespace-nowrap">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleOpen(doc)}
                          disabled={openingId === doc.id}
                        >
                          {openingId === doc.id ? <Spinner size="sm" /> : 'Open'}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(doc)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  )
}

function FileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
  )
}
