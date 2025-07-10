import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface BrevoEmailData {
  sender: {
    name: string
    email: string
  }
  to: Array<{
    email: string
    name: string
  }>
  subject: string
  htmlContent: string
  textContent?: string
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL') ?? 'noreply@educore.com'
const BREVO_SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME') ?? 'EduCore'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { method } = req

    if (method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    const body = await req.json()
    const { type, data } = body

    let result
    switch (type) {
      case 'assignment-due-reminder':
        result = await sendAssignmentDueReminder(data)
        break
      case 'fee-reminder':
        result = await sendFeeReminder(data)
        break
      case 'attendance-alert':
        result = await sendAttendanceAlert(data)
        break
      case 'grade-notification':
        result = await sendGradeNotification(data)
        break
      case 'welcome-email':
        result = await sendWelcomeEmail(data)
        break
      case 'announcement':
        result = await sendAnnouncement(data)
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid notification type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sendEmail(emailData: BrevoEmailData) {
  if (!BREVO_API_KEY) {
    throw new Error('Brevo API key not configured')
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY
    },
    body: JSON.stringify(emailData)
  })

  if (!response.ok) {
    const errorData = await response.text()
    throw new Error(`Brevo API error: ${response.status} - ${errorData}`)
  }

  return await response.json()
}

async function sendAssignmentDueReminder(data: any) {
  const { assignment_id, student_ids } = data

  // Get assignment details
  const { data: assignment, error: assignmentError } = await supabase
    .from('assignments')
    .select(`
      *,
      classes(name, subject),
      users!assignments_teacher_id_fkey(first_name, last_name)
    `)
    .eq('id', assignment_id)
    .single()

  if (assignmentError || !assignment) {
    throw new Error('Assignment not found')
  }

  // Get student details
  const { data: students, error: studentsError } = await supabase
    .from('users')
    .select('id, email, first_name, last_name')
    .in('id', student_ids)

  if (studentsError) {
    throw new Error('Failed to get student details')
  }

  const dueDate = new Date(assignment.due_date).toLocaleDateString()
  const teacherName = `${assignment.users.first_name} ${assignment.users.last_name}`

  const recipients = students.map(student => ({
    email: student.email,
    name: `${student.first_name} ${student.last_name}`
  }))

  const emailData: BrevoEmailData = {
    sender: {
      name: BREVO_SENDER_NAME,
      email: BREVO_SENDER_EMAIL
    },
    to: recipients,
    subject: `Assignment Due Reminder: ${assignment.title}`,
    htmlContent: `
      <h2>Assignment Due Reminder</h2>
      <p>Dear Student,</p>
      <p>This is a friendly reminder that your assignment is due soon:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3>${assignment.title}</h3>
        <p><strong>Class:</strong> ${assignment.classes.name} (${assignment.classes.subject})</p>
        <p><strong>Teacher:</strong> ${teacherName}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
        <p><strong>Description:</strong> ${assignment.description || 'No description provided'}</p>
      </div>
      <p>Please make sure to submit your assignment on time.</p>
      <p>Best regards,<br>EduCore Team</p>
    `,
    textContent: `Assignment Due Reminder: ${assignment.title}\n\nClass: ${assignment.classes.name}\nTeacher: ${teacherName}\nDue Date: ${dueDate}\n\nPlease submit your assignment on time.`
  }

  return await sendEmail(emailData)
}

async function sendFeeReminder(data: any) {
  const { fee_id, student_id } = data

  // Get fee details
  const { data: fee, error: feeError } = await supabase
    .from('fees')
    .select(`
      *,
      users(email, first_name, last_name)
    `)
    .eq('id', fee_id)
    .single()

  if (feeError || !fee) {
    throw new Error('Fee record not found')
  }

  const dueDate = new Date(fee.due_date).toLocaleDateString()

  const emailData: BrevoEmailData = {
    sender: {
      name: BREVO_SENDER_NAME,
      email: BREVO_SENDER_EMAIL
    },
    to: [{
      email: fee.users.email,
      name: `${fee.users.first_name} ${fee.users.last_name}`
    }],
    subject: `Fee Payment Reminder - ${fee.type}`,
    htmlContent: `
      <h2>Fee Payment Reminder</h2>
      <p>Dear ${fee.users.first_name},</p>
      <p>This is a reminder about your pending fee payment:</p>
      <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
        <h3>${fee.type}</h3>
        <p><strong>Amount:</strong> $${fee.amount}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
        <p><strong>Description:</strong> ${fee.description || 'N/A'}</p>
        <p><strong>Status:</strong> ${fee.status}</p>
      </div>
      <p>Please make your payment at your earliest convenience to avoid any late fees.</p>
      <p>If you have already made the payment, please ignore this reminder.</p>
      <p>Best regards,<br>EduCore Administration</p>
    `,
    textContent: `Fee Payment Reminder\n\nType: ${fee.type}\nAmount: $${fee.amount}\nDue Date: ${dueDate}\n\nPlease make your payment at your earliest convenience.`
  }

  return await sendEmail(emailData)
}

async function sendAttendanceAlert(data: any) {
  const { student_id, attendance_rate, period } = data

  // Get student and parent details
  const { data: student, error: studentError } = await supabase
    .from('users')
    .select('email, first_name, last_name')
    .eq('id', student_id)
    .single()

  if (studentError || !student) {
    throw new Error('Student not found')
  }

  const emailData: BrevoEmailData = {
    sender: {
      name: BREVO_SENDER_NAME,
      email: BREVO_SENDER_EMAIL
    },
    to: [{
      email: student.email,
      name: `${student.first_name} ${student.last_name}`
    }],
    subject: `Attendance Alert - Low Attendance`,
    htmlContent: `
      <h2>Attendance Alert</h2>
      <p>Dear ${student.first_name},</p>
      <p>We've noticed that your attendance has been below the required threshold:</p>
      <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545;">
        <p><strong>Current Attendance Rate:</strong> ${attendance_rate}%</p>
        <p><strong>Period:</strong> ${period}</p>
        <p><strong>Required Minimum:</strong> 75%</p>
      </div>
      <p>Regular attendance is crucial for your academic success. Please ensure to attend classes regularly.</p>
      <p>If you have any concerns or need support, please contact your teachers or the administration.</p>
      <p>Best regards,<br>EduCore Administration</p>
    `,
    textContent: `Attendance Alert\n\nYour current attendance rate is ${attendance_rate}% for ${period}. Please improve your attendance to meet the 75% requirement.`
  }

  return await sendEmail(emailData)
}

async function sendGradeNotification(data: any) {
  const { student_id, assignment_id, grade, feedback } = data

  // Get student and assignment details
  const { data: details, error } = await supabase
    .from('assignment_submissions')
    .select(`
      *,
      assignments(title, total_points, classes(name, subject)),
      users(email, first_name, last_name)
    `)
    .eq('student_id', student_id)
    .eq('assignment_id', assignment_id)
    .single()

  if (error || !details) {
    throw new Error('Assignment submission not found')
  }

  const percentage = ((grade / details.assignments.total_points) * 100).toFixed(1)

  const emailData: BrevoEmailData = {
    sender: {
      name: BREVO_SENDER_NAME,
      email: BREVO_SENDER_EMAIL
    },
    to: [{
      email: details.users.email,
      name: `${details.users.first_name} ${details.users.last_name}`
    }],
    subject: `Grade Posted: ${details.assignments.title}`,
    htmlContent: `
      <h2>Grade Notification</h2>
      <p>Dear ${details.users.first_name},</p>
      <p>Your assignment has been graded:</p>
      <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
        <h3>${details.assignments.title}</h3>
        <p><strong>Class:</strong> ${details.assignments.classes.name} (${details.assignments.classes.subject})</p>
        <p><strong>Grade:</strong> ${grade} / ${details.assignments.total_points} (${percentage}%)</p>
        ${feedback ? `<p><strong>Feedback:</strong> ${feedback}</p>` : ''}
      </div>
      <p>Keep up the good work!</p>
      <p>Best regards,<br>Your Teacher</p>
    `,
    textContent: `Grade Notification\n\nAssignment: ${details.assignments.title}\nGrade: ${grade}/${details.assignments.total_points} (${percentage}%)\n${feedback ? `Feedback: ${feedback}` : ''}`
  }

  return await sendEmail(emailData)
}

async function sendWelcomeEmail(data: any) {
  const { user_id, temporary_password } = data

  // Get user details
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('email, first_name, last_name, role')
    .eq('id', user_id)
    .single()

  if (userError || !user) {
    throw new Error('User not found')
  }

  const emailData: BrevoEmailData = {
    sender: {
      name: BREVO_SENDER_NAME,
      email: BREVO_SENDER_EMAIL
    },
    to: [{
      email: user.email,
      name: `${user.first_name} ${user.last_name}`
    }],
    subject: `Welcome to EduCore!`,
    htmlContent: `
      <h2>Welcome to EduCore!</h2>
      <p>Dear ${user.first_name},</p>
      <p>Welcome to EduCore! Your account has been created successfully.</p>
      <div style="background-color: #e2f3ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3>Account Details</h3>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Role:</strong> ${user.role}</p>
        ${temporary_password ? `<p><strong>Temporary Password:</strong> ${temporary_password}</p>` : ''}
      </div>
      ${temporary_password ? '<p><strong>Important:</strong> Please log in and change your password immediately.</p>' : ''}
      <p>You can now access your dashboard and start using EduCore's features.</p>
      <p>If you have any questions, please don't hesitate to contact our support team.</p>
      <p>Best regards,<br>EduCore Team</p>
    `,
    textContent: `Welcome to EduCore!\n\nYour account has been created.\nEmail: ${user.email}\nRole: ${user.role}\n${temporary_password ? `Temporary Password: ${temporary_password}\n\nPlease change your password after logging in.` : ''}`
  }

  return await sendEmail(emailData)
}

async function sendAnnouncement(data: any) {
  const { title, content, recipient_emails, recipient_names } = data

  if (!recipient_emails || !Array.isArray(recipient_emails)) {
    throw new Error('recipient_emails is required and must be an array')
  }

  const recipients = recipient_emails.map((email: string, index: number) => ({
    email,
    name: recipient_names && recipient_names[index] ? recipient_names[index] : ''
  }))

  const emailData: BrevoEmailData = {
    sender: {
      name: BREVO_SENDER_NAME,
      email: BREVO_SENDER_EMAIL
    },
    to: recipients,
    subject: `Announcement: ${title}`,
    htmlContent: `
      <h2>${title}</h2>
      <div style="padding: 15px; border-radius: 5px; margin: 15px 0;">
        ${content}
      </div>
      <p>Best regards,<br>EduCore Administration</p>
    `,
    textContent: `${title}\n\n${content.replace(/<[^>]*>/g, '')}`
  }

  return await sendEmail(emailData)
} 