export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Plan = 'free' | 'indie' | 'pro' | 'team'
export type ProjectStatus = 'draft' | 'in_review' | 'approved' | 'archived'
export type WorkspaceRole = 'owner' | 'editor' | 'viewer'
export type ExportJobStatus = 'pending' | 'processing' | 'done' | 'failed'
export type Platform = 'ios' | 'android' | 'both'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          plan: Plan
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          export_count_this_month: number
          export_reset_at: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          owner_id: string
          plan: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['workspaces']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['workspaces']['Row']>
      }
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: WorkspaceRole
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['workspace_members']['Row'], 'joined_at'>
        Update: Partial<Database['public']['Tables']['workspace_members']['Row']>
      }
      brand_kits: {
        Row: {
          id: string
          workspace_id: string | null
          name: string
          colors: Json
          fonts: Json
          device_preferences: Json
          version: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['brand_kits']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['brand_kits']['Row']>
      }
      projects: {
        Row: {
          id: string
          owner_id: string
          workspace_id: string | null
          name: string
          app_description: string | null
          app_category: string | null
          platform: Platform
          status: ProjectStatus
          canvas_state: Json | null
          thumbnail_url: string | null
          export_count: number
          is_pay_per_project: boolean
          ppp_purchase_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['projects']['Row']>
      }
      project_versions: {
        Row: {
          id: string
          project_id: string
          canvas_state: Json
          saved_at: string
          version_number: number
        }
        Insert: Omit<Database['public']['Tables']['project_versions']['Row'], 'id' | 'saved_at'>
        Update: Partial<Database['public']['Tables']['project_versions']['Row']>
      }
      ab_variants: {
        Row: {
          id: string
          project_id: string
          name: string
          hypothesis: string | null
          is_live: boolean
          canvas_state: Json | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ab_variants']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['ab_variants']['Row']>
      }
      templates: {
        Row: {
          id: string
          name: string
          category: string
          style_tags: string[]
          platform: string
          device_type: string
          aspect_ratio: string | null
          canvas_state: Json
          thumbnail_url: string | null
          is_community: boolean
          author_id: string | null
          is_approved: boolean
          download_count: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['templates']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['templates']['Row']>
      }
      comments: {
        Row: {
          id: string
          project_id: string
          author_id: string
          content: string
          canvas_x: number | null
          canvas_y: number | null
          is_resolved: boolean
          parent_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['comments']['Row']>
      }
      api_keys: {
        Row: {
          id: string
          workspace_id: string
          name: string
          key_hash: string
          key_prefix: string
          scopes: string[]
          last_used_at: string | null
          is_active: boolean
          created_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['api_keys']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['api_keys']['Row']>
      }
      export_jobs: {
        Row: {
          id: string
          project_id: string
          user_id: string
          status: ExportJobStatus
          export_url: string | null
          format: string
          devices: string[]
          error_message: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['export_jobs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['export_jobs']['Row']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          is_read: boolean
          metadata: Json
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Row']>
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectVersion = Database['public']['Tables']['project_versions']['Row']
export type Template = Database['public']['Tables']['templates']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type ExportJob = Database['public']['Tables']['export_jobs']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type ABVariant = Database['public']['Tables']['ab_variants']['Row']
export type BrandKit = Database['public']['Tables']['brand_kits']['Row']
export type ApiKey = Database['public']['Tables']['api_keys']['Row']
