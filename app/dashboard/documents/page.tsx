'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Document {
  id: string
  filename: string
  file_path: string
  file_size: number
  created_at: string
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setDocuments(data || [])
    } catch (err) {
      console.error('Error loading documents:', err)
      setError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return

    const file = e.target.files[0]
    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Validate file type
      const validTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
      ]
      if (!validTypes.includes(file.type)) {
        throw new Error('Only PDF and image files are allowed')
      }

      const MAX_BYTES = 10 * 1024 * 1024
      if (file.size > MAX_BYTES) {
        throw new Error('File is larger than the 10MB limit')
      }

      const filename = `${Date.now()}-${file.name}`
      const filePath = `${user.id}/${filename}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Save metadata to database
      const { error: dbError } = await supabase.from('documents').insert({
        user_id: user.id,
        filename: file.name,
        file_path: filePath,
        file_size: file.size,
      })

      if (dbError) throw dbError

      setSuccess(`${file.name} uploaded successfully`)
      await loadDocuments()
      e.target.value = '' // Reset file input
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete ${doc.filename}?`)) return

    try {
      // Delete from storage
      await supabase.storage.from('documents').remove([doc.file_path])

      // Delete from database
      await supabase.from('documents').delete().eq('id', doc.id)

      setSuccess(`${doc.filename} deleted`)
      await loadDocuments()
    } catch (err) {
      console.error('Delete error:', err)
      setError('Failed to delete document')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Documents</h1>
        <p className="text-muted mt-1">
          Upload and manage your study materials
        </p>
      </div>

      {/* Upload Card */}
      <div className="bg-surface rounded-lg p-8 shadow border-2 border-dashed border-primary/40">
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-2">📤</div>
            <h2 className="text-lg font-semibold text-ink mb-1">
              Upload Documents
            </h2>
            <p className="text-muted text-sm">
              PDF and image files only (max 10MB)
            </p>
          </div>

          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            accept=".pdf,image/*"
            className="block w-full"
          />

          {uploading && (
            <div className="text-center text-muted">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
              Uploading...
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-error/10 border border-error/30 text-error rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-success/10 border border-success/30 text-success rounded">
          {success}
        </div>
      )}

      {/* Documents List */}
      <div className="bg-surface rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-muted">
            No documents uploaded yet. Start by uploading a file!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-line">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink">
                    Filename
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink">
                    Uploaded
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-ink">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-surface-hover transition">
                    <td className="px-6 py-4 text-sm text-ink">
                      {doc.filename}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleDelete(doc)}
                        className="text-error hover:opacity-80 font-semibold transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
