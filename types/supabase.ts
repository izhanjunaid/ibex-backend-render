export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          password_hash: string | null
          role: 'admin' | 'teacher' | 'student' | 'parent'
          status: 'active' | 'inactive' | 'suspended'
          first_name: string
          last_name: string
          phone: string | null
          date_of_birth: string | null
          address: string | null
          profile_image_url: string | null
          emergency_contact: Json | null
          created_at: string
          updated_at: string
          last_login: string | null
          email_verified: boolean | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          email: string
          password_hash?: string | null
          role?: 'admin' | 'teacher' | 'student' | 'parent'
          status?: 'active' | 'inactive' | 'suspended'
          first_name: string
          last_name: string
          phone?: string | null
          date_of_birth?: string | null
          address?: string | null
          profile_image_url?: string | null
          emergency_contact?: Json | null
          created_at?: string
          updated_at?: string
          last_login?: string | null
          email_verified?: boolean | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string | null
          role?: 'admin' | 'teacher' | 'student' | 'parent'
          status?: 'active' | 'inactive' | 'suspended'
          first_name?: string
          last_name?: string
          phone?: string | null
          date_of_birth?: string | null
          address?: string | null
          profile_image_url?: string | null
          emergency_contact?: Json | null
          created_at?: string
          updated_at?: string
          last_login?: string | null
          email_verified?: boolean | null
          metadata?: Json | null
        }
      }
      schools: {
        Row: {
          id: string
          name: string
          code: string
          address: string | null
          phone: string | null
          email: string | null
          website: string | null
          logo_url: string | null
          settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          address?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          logo_url?: string | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          logo_url?: string | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      classes: {
        Row: {
          id: string
          school_id: string | null
          name: string
          code: string
          description: string | null
          subject: string | null
          grade_level: number | null
          teacher_id: string | null
          room_number: string | null
          schedule: Json | null
          max_students: number | null
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          school_id?: string | null
          name: string
          code: string
          description?: string | null
          subject?: string | null
          grade_level?: number | null
          teacher_id?: string | null
          room_number?: string | null
          schedule?: Json | null
          max_students?: number | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          school_id?: string | null
          name?: string
          code?: string
          description?: string | null
          subject?: string | null
          grade_level?: number | null
          teacher_id?: string | null
          room_number?: string | null
          schedule?: Json | null
          max_students?: number | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      class_enrollments: {
        Row: {
          id: string
          class_id: string | null
          student_id: string | null
          enrolled_at: string
          status: string | null
        }
        Insert: {
          id?: string
          class_id?: string | null
          student_id?: string | null
          enrolled_at?: string
          status?: string | null
        }
        Update: {
          id?: string
          class_id?: string | null
          student_id?: string | null
          enrolled_at?: string
          status?: string | null
        }
      }
      assignments: {
        Row: {
          id: string
          class_id: string | null
          teacher_id: string | null
          title: string
          description: string | null
          instructions: string | null
          due_date: string | null
          total_points: number | null
          status: 'draft' | 'published' | 'closed' | null
          attachments: Json | null
          rubric: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          class_id?: string | null
          teacher_id?: string | null
          title: string
          description?: string | null
          instructions?: string | null
          due_date?: string | null
          total_points?: number | null
          status?: 'draft' | 'published' | 'closed' | null
          attachments?: Json | null
          rubric?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          class_id?: string | null
          teacher_id?: string | null
          title?: string
          description?: string | null
          instructions?: string | null
          due_date?: string | null
          total_points?: number | null
          status?: 'draft' | 'published' | 'closed' | null
          attachments?: Json | null
          rubric?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      assignment_submissions: {
        Row: {
          id: string
          assignment_id: string | null
          student_id: string | null
          content: string | null
          attachments: Json | null
          submitted_at: string | null
          status: 'pending' | 'submitted' | 'graded' | 'returned' | null
          grade: number | null
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          assignment_id?: string | null
          student_id?: string | null
          content?: string | null
          attachments?: Json | null
          submitted_at?: string | null
          status?: 'pending' | 'submitted' | 'graded' | 'returned' | null
          grade?: number | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          assignment_id?: string | null
          student_id?: string | null
          content?: string | null
          attachments?: Json | null
          submitted_at?: string | null
          status?: 'pending' | 'submitted' | 'graded' | 'returned' | null
          grade?: number | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      attendance: {
        Row: {
          id: string
          grade_section_id: string | null
          student_id: string | null
          date: string
          status: 'present' | 'absent' | 'late' | 'excused'
          notes: string | null
          marked_by: string | null
          marked_at: string
          created_at: string
        }
        Insert: {
          id?: string
          grade_section_id?: string | null
          student_id?: string | null
          date: string
          status: 'present' | 'absent' | 'late' | 'excused'
          notes?: string | null
          marked_by?: string | null
          marked_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          grade_section_id?: string | null
          student_id?: string | null
          date?: string
          status?: 'present' | 'absent' | 'late' | 'excused'
          notes?: string | null
          marked_by?: string | null
          marked_at?: string
          created_at?: string
        }
      }
      grades: {
        Row: {
          id: string
          student_id: string | null
          class_id: string | null
          assignment_id: string | null
          type: 'assignment' | 'exam' | 'quiz' | 'project' | 'participation'
          points_earned: number | null
          points_possible: number | null
          percentage: number | null
          letter_grade: string | null
          comments: string | null
          graded_by: string | null
          graded_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id?: string | null
          class_id?: string | null
          assignment_id?: string | null
          type: 'assignment' | 'exam' | 'quiz' | 'project' | 'participation'
          points_earned?: number | null
          points_possible?: number | null
          percentage?: number | null
          letter_grade?: string | null
          comments?: string | null
          graded_by?: string | null
          graded_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string | null
          class_id?: string | null
          assignment_id?: string | null
          type?: 'assignment' | 'exam' | 'quiz' | 'project' | 'participation'
          points_earned?: number | null
          points_possible?: number | null
          percentage?: number | null
          letter_grade?: string | null
          comments?: string | null
          graded_by?: string | null
          graded_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      fees: {
        Row: {
          id: string
          school_id: string | null
          student_id: string | null
          type: string
          amount: number
          due_date: string | null
          status: 'pending' | 'paid' | 'overdue' | 'cancelled' | null
          description: string | null
          payment_method: string | null
          payment_reference: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          school_id?: string | null
          student_id?: string | null
          type: string
          amount: number
          due_date?: string | null
          status?: 'pending' | 'paid' | 'overdue' | 'cancelled' | null
          description?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          school_id?: string | null
          student_id?: string | null
          type?: string
          amount?: number
          due_date?: string | null
          status?: 'pending' | 'paid' | 'overdue' | 'cancelled' | null
          description?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          sender_id: string | null
          recipient_ids: string[]
          subject: string | null
          body: string
          type: 'individual' | 'group' | 'broadcast' | null
          attachments: Json | null
          is_read: boolean | null
          parent_message_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sender_id?: string | null
          recipient_ids: string[]
          subject?: string | null
          body: string
          type?: 'individual' | 'group' | 'broadcast' | null
          attachments?: Json | null
          is_read?: boolean | null
          parent_message_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sender_id?: string | null
          recipient_ids?: string[]
          subject?: string | null
          body?: string
          type?: 'individual' | 'group' | 'broadcast' | null
          attachments?: Json | null
          is_read?: boolean | null
          parent_message_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      grade_sections: {
        Row: {
          id: string
          school_id: string | null
          grade_level: number
          section: string
          name: string
          description: string | null
          teacher_id: string | null
          academic_year: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          school_id?: string | null
          grade_level: number
          section: string
          name: string
          description?: string | null
          teacher_id?: string | null
          academic_year: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          school_id?: string | null
          grade_level?: number
          section?: string
          name?: string
          description?: string | null
          teacher_id?: string | null
          academic_year?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      homework_announcements: {
        Row: {
          id: string
          grade_section_id: string | null
          teacher_id: string | null
          title: string
          content: string | null
          homework_date: string
          subjects: Json
          pdf_file_id: string | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          grade_section_id?: string | null
          teacher_id?: string | null
          title: string
          content?: string | null
          homework_date: string
          subjects: Json
          pdf_file_id?: string | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          grade_section_id?: string | null
          teacher_id?: string | null
          title?: string
          content?: string | null
          homework_date?: string
          subjects?: Json
          pdf_file_id?: string | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      grade_section_enrollments: {
        Row: {
          id: string
          grade_section_id: string | null
          student_id: string | null
          enrolled_at: string
          status: string | null
        }
        Insert: {
          id?: string
          grade_section_id?: string | null
          student_id?: string | null
          enrolled_at?: string
          status?: string | null
        }
        Update: {
          id?: string
          grade_section_id?: string | null
          student_id?: string | null
          enrolled_at?: string
          status?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'admin' | 'teacher' | 'student' | 'parent'
      user_status: 'active' | 'inactive' | 'suspended'
      attendance_status: 'present' | 'absent' | 'late' | 'excused'
      assignment_status: 'draft' | 'published' | 'closed'
      submission_status: 'pending' | 'submitted' | 'graded' | 'returned'
      grade_type: 'assignment' | 'exam' | 'quiz' | 'project' | 'participation'
      fee_status: 'pending' | 'paid' | 'overdue' | 'cancelled'
      message_type: 'individual' | 'group' | 'broadcast'
    }
  }
} 