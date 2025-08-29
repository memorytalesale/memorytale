import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos TypeScript para la base de datos
export type Database = {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string
          session_id: string
          current_step: string
          selected_recipient: string | null
          collected_data: any
          emotional_profile: any
          completion_time_minutes: number | null
          user_agent: string | null
          is_complete: boolean
          final_outcome: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          current_step?: string
          selected_recipient?: string | null
          collected_data?: any
          emotional_profile?: any
          completion_time_minutes?: number | null
          user_agent?: string | null
          is_complete?: boolean
          final_outcome?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          current_step?: string
          selected_recipient?: string | null
          collected_data?: any
          emotional_profile?: any
          completion_time_minutes?: number | null
          user_agent?: string | null
          is_complete?: boolean
          final_outcome?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          session_id: string
          sender: string
          content: string
          step_at_message: string | null
          emotional_tone: string | null
          query_type: string | null
          response_time_ms: number | null
          timestamp: string
        }
        Insert: {
          id?: string
          session_id: string
          sender: string
          content: string
          step_at_message?: string | null
          emotional_tone?: string | null
          query_type?: string | null
          response_time_ms?: number | null
          timestamp?: string
        }
      }
      analytics_events: {
        Row: {
          id: string
          session_id: string
          event_type: string | null
          event_data: any | null
          timestamp: string
        }
        Insert: {
          id?: string
          session_id: string
          event_type?: string | null
          event_data?: any | null
          timestamp?: string
        }
      }
    }
  }
}
