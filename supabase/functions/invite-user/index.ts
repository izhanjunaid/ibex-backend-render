import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const brevoApiKey = Deno.env.get('BREVO_API_KEY')!
const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    // Get the current user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Authentication failed')
    }

    // Get user details from database
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role, email, first_name, last_name')
      .eq('id', user.id)
      .single()

    if (userError || !currentUser) {
      throw new Error('User not found')
    }

    // Parse request body
    const { email, role } = await req.json()

    if (!email || !role) {
      throw new Error('Email and role are required')
    }

    if (!['teacher', 'student'].includes(role)) {
      throw new Error('Invalid role. Only teacher and student are allowed')
    }

    // Validate invite permissions
    const canInvite = (
      (currentUser.role === 'admin' && ['teacher', 'student'].includes(role)) ||
      (currentUser.role === 'teacher' && role === 'student')
    )

    if (!canInvite) {
      throw new Error('You do not have permission to invite users with this role')
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      throw new Error('User with this email already exists')
    }

    // Check if there's already a pending invite
    const { data: existingInvite } = await supabase
      .from('invites')
      .select('id, expires_at')
      .eq('email', email)
      .is('accepted_at', null)
      .single()

    if (existingInvite) {
      // Check if invite is still valid
      const now = new Date()
      const expiresAt = new Date(existingInvite.expires_at)
      
      if (expiresAt > now) {
        throw new Error('A pending invitation already exists for this email')
      }
    }

    // Create new invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert({
        email,
        role,
        invited_by: currentUser.id,
        invited_by_role: currentUser.role
      })
      .select('*')
      .single()

    if (inviteError) {
      throw new Error(`Failed to create invite: ${inviteError.message}`)
    }

    // Send invitation email via Brevo
    const inviteUrl = `${appUrl}/accept-invite?token=${invite.token}`
    
    const emailData = {
      sender: {
        email: Deno.env.get('BREVO_SENDER_EMAIL') || 'noreply@educore.com',
        name: Deno.env.get('BREVO_SENDER_NAME') || 'EduCore'
      },
      to: [{ email }],
      subject: `You're invited to join EduCore as a ${role}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Welcome to EduCore!</h2>
          <p>You have been invited by ${currentUser.first_name} ${currentUser.last_name} to join EduCore as a <strong>${role}</strong>.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Getting Started:</h3>
            <ol>
              <li>Click the invitation link below</li>
              <li>Set up your password</li>
              <li>Start using EduCore!</li>
            </ol>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="background-color: #1976d2; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; font-weight: bold;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            <strong>Note:</strong> This invitation will expire in 7 days. 
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
          
          <p style="color: #666; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${inviteUrl}">${inviteUrl}</a>
          </p>
        </div>
      `
    }

    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey
      },
      body: JSON.stringify(emailData)
    })

    if (!emailResponse.ok) {
      const emailError = await emailResponse.text()
      console.error('Email sending failed:', emailError)
      throw new Error('Failed to send invitation email')
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation sent successfully',
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expires_at: invite.expires_at
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Invite user error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
}) 