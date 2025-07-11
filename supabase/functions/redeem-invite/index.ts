import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { token, password, firstName, lastName } = await req.json()

    if (!token || !password) {
      throw new Error('Token and password are required')
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }

    if (!firstName || !lastName) {
      throw new Error('First name and last name are required')
    }

    // Look up the invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .single()

    if (inviteError || !invite) {
      throw new Error('Invalid or expired invitation token')
    }

    // Check if invite has expired
    const now = new Date()
    const expiresAt = new Date(invite.expires_at)
    
    if (expiresAt < now) {
      throw new Error('This invitation has expired')
    }

    // Check if user already exists with this email
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', invite.email)
      .single()

    if (existingUser) {
      throw new Error('A user with this email already exists')
    }

    // Create the user account using admin API
    const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true, // Skip email confirmation for invited users
      user_metadata: {
        role: invite.role,
        first_name: firstName,
        last_name: lastName,
        invited_by: invite.invited_by
      }
    })

    if (createUserError || !authUser.user) {
      console.error('User creation error:', createUserError)
      throw new Error('Failed to create user account')
    }

    // Insert user data into our users table
    const { error: insertUserError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: invite.email,
        role: invite.role,
        first_name: firstName,
        last_name: lastName,
        status: 'active',
        created_at: new Date().toISOString()
      })

    if (insertUserError) {
      console.error('User insert error:', insertUserError)
      // If we can't insert into users table, clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      throw new Error('Failed to create user profile')
    }

    // Mark the invite as accepted
    const { error: updateInviteError } = await supabaseAdmin
      .from('invites')
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: authUser.user.id
      })
      .eq('id', invite.id)

    if (updateInviteError) {
      console.error('Invite update error:', updateInviteError)
      // Note: We don't fail here since the user was created successfully
    }

    // Get the inviter's information for the response
    const { data: inviter } = await supabaseAdmin
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', invite.invited_by)
      .single()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account created successfully! You can now log in.',
        user: {
          id: authUser.user.id,
          email: authUser.user.email,
          role: invite.role,
          first_name: firstName,
          last_name: lastName
        },
        inviter: inviter ? {
          name: `${inviter.first_name} ${inviter.last_name}`,
          email: inviter.email
        } : null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Redeem invite error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message?.includes('Token') || error.message?.includes('expired') ? 400 : 500
      }
    )
  }
})
