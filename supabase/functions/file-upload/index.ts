import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Allowed file types and sizes
const ALLOWED_TYPES = {
  'image/jpeg': { maxSize: 5 * 1024 * 1024, bucket: 'images' }, // 5MB
  'image/png': { maxSize: 5 * 1024 * 1024, bucket: 'images' },
  'image/gif': { maxSize: 5 * 1024 * 1024, bucket: 'images' },
  'application/pdf': { maxSize: 10 * 1024 * 1024, bucket: 'documents' }, // 10MB
  'application/msword': { maxSize: 10 * 1024 * 1024, bucket: 'documents' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { maxSize: 10 * 1024 * 1024, bucket: 'documents' },
  'video/mp4': { maxSize: 100 * 1024 * 1024, bucket: 'videos' }, // 100MB
  'video/webm': { maxSize: 100 * 1024 * 1024, bucket: 'videos' },
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'POST') {
      return await handleUpload(req, user.id)
    } else if (req.method === 'DELETE') {
      return await handleDelete(req, user.id)
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('File upload error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleUpload(req: Request, userId: string) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const folder = formData.get('folder') as string || 'general'
  const isPublic = formData.get('public') === 'true'

  if (!file) {
    return new Response(
      JSON.stringify({ error: 'No file provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate file type and size
  const fileConfig = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]
  if (!fileConfig) {
    return new Response(
      JSON.stringify({ error: `File type ${file.type} not allowed` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (file.size > fileConfig.maxSize) {
    return new Response(
      JSON.stringify({ error: `File size exceeds limit of ${fileConfig.maxSize / (1024 * 1024)}MB` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Generate unique filename
  const timestamp = new Date().getTime()
  const randomString = Math.random().toString(36).substring(2, 15)
  const fileExtension = file.name.split('.').pop()
  const fileName = `${timestamp}_${randomString}.${fileExtension}`
  const filePath = `${folder}/${fileName}`

  try {
    // Convert file to ArrayBuffer
    const fileBuffer = await file.arrayBuffer()

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(fileConfig.bucket)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        metadata: {
          uploadedBy: userId,
          originalName: file.name,
          size: file.size.toString()
        }
      })

    if (error) throw error

    // Get public URL if requested
    let publicUrl = null
    if (isPublic) {
      const { data: urlData } = supabase.storage
        .from(fileConfig.bucket)
        .getPublicUrl(filePath)
      publicUrl = urlData.publicUrl
    } else {
      // Create signed URL (expires in 1 hour)
      const { data: urlData, error: urlError } = await supabase.storage
        .from(fileConfig.bucket)
        .createSignedUrl(filePath, 3600)
      
      if (!urlError) {
        publicUrl = urlData.signedUrl
      }
    }

    // Save file metadata to database
    const { data: fileRecord, error: dbError } = await supabase
      .from('file_uploads')
      .insert({
        user_id: userId,
        filename: fileName,
        original_name: file.name,
        file_path: filePath,
        file_size: file.size,
        content_type: file.type,
        bucket: fileConfig.bucket,
        folder: folder,
        is_public: isPublic,
        upload_url: publicUrl
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // If DB insert fails, try to cleanup the uploaded file
      await supabase.storage.from(fileConfig.bucket).remove([filePath])
      throw dbError
    }

    return new Response(
      JSON.stringify({
        message: 'File uploaded successfully',
        file: {
          id: fileRecord.id,
          filename: fileName,
          originalName: file.name,
          url: publicUrl,
          size: file.size,
          type: file.type,
          bucket: fileConfig.bucket,
          path: filePath
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Upload error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to upload file' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleDelete(req: Request, userId: string) {
  const url = new URL(req.url)
  const fileId = url.searchParams.get('id')

  if (!fileId) {
    return new Response(
      JSON.stringify({ error: 'File ID required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get file record from database
    const { data: fileRecord, error: fetchError } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId) // Ensure user owns the file
      .single()

    if (fetchError || !fileRecord) {
      return new Response(
        JSON.stringify({ error: 'File not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(fileRecord.bucket)
      .remove([fileRecord.file_path])

    if (storageError) {
      console.error('Storage deletion error:', storageError)
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('file_uploads')
      .delete()
      .eq('id', fileId)

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ message: 'File deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Delete error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to delete file' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
} 