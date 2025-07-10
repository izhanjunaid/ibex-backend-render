import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface Database {
  public: {
    Tables: {
      attendance: {
        Row: {
          id: string
          class_id: string
          student_id: string
          date: string
          status: 'present' | 'absent' | 'late' | 'excused'
          notes: string | null
          marked_by: string
          marked_at: string
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          student_id: string
          date: string
          status: 'present' | 'absent' | 'late' | 'excused'
          notes?: string | null
          marked_by: string
          marked_at?: string
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          role: string
          first_name: string
          last_name: string
        }
      }
      classes: {
        Row: {
          id: string
          name: string
          teacher_id: string
        }
      }
    }
  }
}

const supabase = createClient<Database>(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { method } = req
    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    
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

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    switch (method) {
      case 'GET':
        return await handleGet(url, user.id, userProfile.role)
      case 'POST':
        return await handlePost(req, user.id, userProfile.role)
      case 'PUT':
        return await handlePut(req, user.id, userProfile.role)
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleGet(url: URL, userId: string, userRole: string) {
  const searchParams = url.searchParams
  const classId = searchParams.get('class_id')
  const date = searchParams.get('date')
  const studentId = searchParams.get('student_id')

  // GET /attendance?class_id=xxx&date=yyyy-mm-dd - Get attendance for a class on a specific date
  if (classId && date) {
    // Check if user has access to this class
    if (userRole !== 'admin') {
      const { data: classData } = await supabase
        .from('classes')
        .select('teacher_id')
        .eq('id', classId)
        .single()

      if (userRole === 'teacher' && classData?.teacher_id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        users!attendance_student_id_fkey(id, first_name, last_name)
      `)
      .eq('class_id', classId)
      .eq('date', date)

    if (error) throw error

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // GET /attendance?student_id=xxx - Get attendance history for a student
  if (studentId) {
    // Check access - students can only see their own, teachers can see their class students
    if (userRole === 'student' && studentId !== userId) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        classes(name, subject)
      `)
      .eq('student_id', studentId)
      .order('date', { ascending: false })
      .limit(50)

    if (error) throw error

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // GET /attendance/stats?class_id=xxx - Get attendance statistics
  if (url.pathname.includes('/stats') && classId) {
    const { data, error } = await supabase
      .from('attendance')
      .select('status, student_id')
      .eq('class_id', classId)

    if (error) throw error

    // Calculate stats
    const stats = data.reduce((acc: any, record) => {
      const status = record.status
      if (!acc[status]) acc[status] = 0
      acc[status]++
      return acc
    }, {})

    const totalRecords = data.length
    const presentCount = stats.present || 0
    const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0

    return new Response(
      JSON.stringify({ 
        stats, 
        totalRecords, 
        attendanceRate: Math.round(attendanceRate * 100) / 100 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ error: 'Invalid request' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handlePost(req: Request, userId: string, userRole: string) {
  if (userRole !== 'admin' && userRole !== 'teacher') {
    return new Response(
      JSON.stringify({ error: 'Access denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.json()
  const { class_id, date, attendance_records } = body

  // Validate required fields
  if (!class_id || !date || !Array.isArray(attendance_records)) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check if user has access to this class
  if (userRole === 'teacher') {
    const { data: classData } = await supabase
      .from('classes')
      .select('teacher_id')
      .eq('id', class_id)
      .single()

    if (classData?.teacher_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this class' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  // Prepare attendance records for insertion
  const attendanceData = attendance_records.map((record: any) => ({
    class_id,
    student_id: record.student_id,
    date,
    status: record.status,
    notes: record.notes || null,
    marked_by: userId,
    marked_at: new Date().toISOString()
  }))

  // Use upsert to handle duplicate entries (update if exists, insert if not)
  const { data, error } = await supabase
    .from('attendance')
    .upsert(attendanceData, { 
      onConflict: 'class_id,student_id,date',
      ignoreDuplicates: false 
    })
    .select()

  if (error) throw error

  return new Response(
    JSON.stringify({ message: 'Attendance marked successfully', data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handlePut(req: Request, userId: string, userRole: string) {
  if (userRole !== 'admin' && userRole !== 'teacher') {
    return new Response(
      JSON.stringify({ error: 'Access denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.json()
  const { attendance_id, status, notes } = body

  if (!attendance_id || !status) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Update attendance record
  const { data, error } = await supabase
    .from('attendance')
    .update({
      status,
      notes,
      marked_by: userId,
      marked_at: new Date().toISOString()
    })
    .eq('id', attendance_id)
    .select()
    .single()

  if (error) throw error

  return new Response(
    JSON.stringify({ message: 'Attendance updated successfully', data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
} 