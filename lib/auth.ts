import { supabase } from './supabase'
import { Database } from '../types/supabase'

export type User = Database['public']['Tables']['users']['Row']
export type UserRole = Database['public']['Enums']['user_role']

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  first_name: string
  last_name: string
  profile_image_url?: string
}

export const authHelpers = {
  // Sign up new user
  async signUp(email: string, password: string, userData: {
    first_name: string
    last_name: string
    role: UserRole
    phone?: string
    date_of_birth?: string
  }) {
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role
          }
        }
      })

      if (authError) throw authError

      // 2. Create user profile in our custom users table
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: authData.user.email!,
            role: userData.role,
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone: userData.phone,
            date_of_birth: userData.date_of_birth,
            email_verified: false
          })

        if (profileError) throw profileError
      }

      return { data: authData, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Sign in user
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Sign out user
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { success: true, error: null }
    } catch (error) {
      return { success: false, error }
    }
  },

  // Get current user with profile data
  async getCurrentUser(): Promise<{ user: AuthUser | null, error: any }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        return { user: null, error: authError }
      }

      // Get user profile from our users table
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        return { user: null, error: profileError }
      }

      const authUser: AuthUser = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        first_name: profile.first_name,
        last_name: profile.last_name,
        profile_image_url: profile.profile_image_url
      }

      return { user: authUser, error: null }
    } catch (error) {
      return { user: null, error }
    }
  },

  // Update user profile
  async updateProfile(userId: string, updates: Partial<User>) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Reset password
  async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
      })
      
      if (error) throw error
      return { success: true, error: null }
    } catch (error) {
      return { success: false, error }
    }
  },

  // Update password
  async updatePassword(newPassword: string) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) throw error
      return { success: true, error: null }
    } catch (error) {
      return { success: false, error }
    }
  },

  // Check if user has role
  hasRole(user: AuthUser | null, roles: UserRole | UserRole[]): boolean {
    if (!user) return false
    const roleArray = Array.isArray(roles) ? roles : [roles]
    return roleArray.includes(user.role)
  },

  // Check if user is admin
  isAdmin(user: AuthUser | null): boolean {
    return this.hasRole(user, 'admin')
  },

  // Check if user is teacher
  isTeacher(user: AuthUser | null): boolean {
    return this.hasRole(user, ['admin', 'teacher'])
  },

  // Check if user is student
  isStudent(user: AuthUser | null): boolean {
    return this.hasRole(user, 'student')
  },

  // Get user's full name
  getFullName(user: AuthUser | null): string {
    if (!user) return ''
    return `${user.first_name} ${user.last_name}`
  }
} 