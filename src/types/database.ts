// Fichier GÉNÉRÉ par `npm run db:types` depuis le schéma Supabase. Ne pas modifier à la main.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_access_log: {
        Row: {
          created_at: string
          email_fingerprint: string | null
          event: string
          id: string
          ip_fingerprint: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_fingerprint?: string | null
          event: string
          id?: string
          ip_fingerprint?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_fingerprint?: string | null
          event?: string
          id?: string
          ip_fingerprint?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          cost_usd: number
          created_at: string
          feature: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          user_id: string | null
        }
        Insert: {
          cost_usd: number
          created_at?: string
          feature: string
          id?: string
          input_tokens: number
          model: string
          output_tokens: number
          user_id?: string | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          feature?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appeals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          message: string
          status: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          message: string
          status?: string
          target_id: string
          target_type: string
          user_id?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          message?: string
          status?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appeals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          accepts_quotes: boolean
          address_text: string | null
          availability_declared_at: string | null
          availability_note: string | null
          category_id: string | null
          city_id: string
          cover_path: string | null
          created_at: string
          description: string | null
          email: string | null
          faq: Json
          id: string
          is_claimed: boolean
          links: Json
          location: unknown
          location_precision: Database["public"]["Enums"]["location_precision"]
          location_public: unknown
          logo_path: string | null
          name: string
          neighborhood_id: string | null
          opening_hours: Json | null
          organization_id: string | null
          owner_id: string
          phone: string | null
          public_location_precision: Database["public"]["Enums"]["public_location_precision"]
          published_at: string | null
          rejection_reason: string | null
          search_vector: unknown
          service_area: string | null
          services: string[]
          slug: string
          source_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          accepts_quotes?: boolean
          address_text?: string | null
          availability_declared_at?: string | null
          availability_note?: string | null
          category_id?: string | null
          city_id: string
          cover_path?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          faq?: Json
          id?: string
          is_claimed?: boolean
          links?: Json
          location?: unknown
          location_precision?: Database["public"]["Enums"]["location_precision"]
          location_public?: unknown
          logo_path?: string | null
          name: string
          neighborhood_id?: string | null
          opening_hours?: Json | null
          organization_id?: string | null
          owner_id: string
          phone?: string | null
          public_location_precision?: Database["public"]["Enums"]["public_location_precision"]
          published_at?: string | null
          rejection_reason?: string | null
          search_vector?: unknown
          service_area?: string | null
          services?: string[]
          slug: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          accepts_quotes?: boolean
          address_text?: string | null
          availability_declared_at?: string | null
          availability_note?: string | null
          category_id?: string | null
          city_id?: string
          cover_path?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          faq?: Json
          id?: string
          is_claimed?: boolean
          links?: Json
          location?: unknown
          location_precision?: Database["public"]["Enums"]["location_precision"]
          location_public?: unknown
          logo_path?: string | null
          name?: string
          neighborhood_id?: string | null
          opening_hours?: Json | null
          organization_id?: string | null
          owner_id?: string
          phone?: string | null
          public_location_precision?: Database["public"]["Enums"]["public_location_precision"]
          published_at?: string | null
          rejection_reason?: string | null
          search_vector?: unknown
          service_area?: string | null
          services?: string[]
          slug?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profiles_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profiles_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profiles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_verification_requests: {
        Row: {
          business_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          evidence: string
          id: string
          requested_by: string
          status: string
        }
        Insert: {
          business_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence: string
          id?: string
          requested_by?: string
          status?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence?: string
          id?: string
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_verification_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_verification_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_verification_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_view_counts: {
        Row: {
          business_id: string
          updated_at: string
          views: number
        }
        Insert: {
          business_id: string
          updated_at?: string
          views?: number
        }
        Update: {
          business_id?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_view_counts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_view_marks: {
        Row: {
          business_id: string
          day: string
          viewer_hash: string
        }
        Insert: {
          business_id: string
          day?: string
          viewer_hash: string
        }
        Update: {
          business_id?: string
          day?: string
          viewer_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_view_marks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cabin_networks: {
        Row: {
          code: string
          is_active: boolean
          kind: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          kind: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          kind?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      cabin_offers: {
        Row: {
          checked_on: string
          created_by: string | null
          data_volume: string | null
          id: string
          is_active: boolean
          name: string
          network_code: string
          price_xof: number
          source: string
          updated_at: string
          validity: string | null
        }
        Insert: {
          checked_on?: string
          created_by?: string | null
          data_volume?: string | null
          id?: string
          is_active?: boolean
          name: string
          network_code: string
          price_xof: number
          source: string
          updated_at?: string
          validity?: string | null
        }
        Update: {
          checked_on?: string
          created_by?: string | null
          data_volume?: string | null
          id?: string
          is_active?: boolean
          name?: string
          network_code?: string
          price_xof?: number
          source?: string
          updated_at?: string
          validity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cabin_offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabin_offers_network_code_fkey"
            columns: ["network_code"]
            isOneToOne: false
            referencedRelation: "cabin_networks"
            referencedColumns: ["code"]
          },
        ]
      }
      cabin_operation_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string | null
          from_status: Database["public"]["Enums"]["cabin_status"] | null
          id: string
          operation_id: string
          source: string
          to_status: Database["public"]["Enums"]["cabin_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          from_status?: Database["public"]["Enums"]["cabin_status"] | null
          id?: string
          operation_id: string
          source: string
          to_status: Database["public"]["Enums"]["cabin_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          from_status?: Database["public"]["Enums"]["cabin_status"] | null
          id?: string
          operation_id?: string
          source?: string
          to_status?: Database["public"]["Enums"]["cabin_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cabin_operation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabin_operation_events_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "cabin_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      cabin_operations: {
        Row: {
          amount_xof: number
          completed_at: string | null
          created_at: string
          delivery_code: string | null
          fee_bps: number
          follow_token_hash: string
          id: string
          idempotency_key: string
          mode: Database["public"]["Enums"]["cabin_mode"]
          network_code: string
          offer_id: string | null
          provider_code: string | null
          provider_fee_xof: number
          provider_reference: string | null
          quote_expires_at: string
          recipient_fingerprint: string
          recipient_masked: string
          reference: string
          service: Database["public"]["Enums"]["cabin_service"]
          service_fee_xof: number
          status: Database["public"]["Enums"]["cabin_status"]
          status_reason: string | null
          target_network_code: string | null
          total_xof: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_xof: number
          completed_at?: string | null
          created_at?: string
          delivery_code?: string | null
          fee_bps: number
          follow_token_hash: string
          id?: string
          idempotency_key: string
          mode: Database["public"]["Enums"]["cabin_mode"]
          network_code: string
          offer_id?: string | null
          provider_code?: string | null
          provider_fee_xof?: number
          provider_reference?: string | null
          quote_expires_at: string
          recipient_fingerprint: string
          recipient_masked: string
          reference?: string
          service: Database["public"]["Enums"]["cabin_service"]
          service_fee_xof: number
          status?: Database["public"]["Enums"]["cabin_status"]
          status_reason?: string | null
          target_network_code?: string | null
          total_xof: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_xof?: number
          completed_at?: string | null
          created_at?: string
          delivery_code?: string | null
          fee_bps?: number
          follow_token_hash?: string
          id?: string
          idempotency_key?: string
          mode?: Database["public"]["Enums"]["cabin_mode"]
          network_code?: string
          offer_id?: string | null
          provider_code?: string | null
          provider_fee_xof?: number
          provider_reference?: string | null
          quote_expires_at?: string
          recipient_fingerprint?: string
          recipient_masked?: string
          reference?: string
          service?: Database["public"]["Enums"]["cabin_service"]
          service_fee_xof?: number
          status?: Database["public"]["Enums"]["cabin_status"]
          status_reason?: string | null
          target_network_code?: string | null
          total_xof?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cabin_operations_network_code_fkey"
            columns: ["network_code"]
            isOneToOne: false
            referencedRelation: "cabin_networks"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cabin_operations_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "cabin_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabin_operations_provider_code_fkey"
            columns: ["provider_code"]
            isOneToOne: false
            referencedRelation: "cabin_providers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cabin_operations_target_network_code_fkey"
            columns: ["target_network_code"]
            isOneToOne: false
            referencedRelation: "cabin_networks"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cabin_operations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cabin_providers: {
        Row: {
          code: string
          description: string | null
          is_active: boolean
          mode: Database["public"]["Enums"]["cabin_mode"]
          name: string
          services: Database["public"]["Enums"]["cabin_service"][]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          description?: string | null
          is_active?: boolean
          mode?: Database["public"]["Enums"]["cabin_mode"]
          name: string
          services?: Database["public"]["Enums"]["cabin_service"][]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          description?: string | null
          is_active?: boolean
          mode?: Database["public"]["Enums"]["cabin_mode"]
          name?: string
          services?: Database["public"]["Enums"]["cabin_service"][]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cabin_providers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cabin_service_settings: {
        Row: {
          description: string
          fee_bps: number
          is_enabled: boolean
          label: string
          max_amount_xof: number
          min_amount_xof: number
          provider_code: string | null
          service: Database["public"]["Enums"]["cabin_service"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description: string
          fee_bps?: number
          is_enabled?: boolean
          label: string
          max_amount_xof: number
          min_amount_xof: number
          provider_code?: string | null
          service: Database["public"]["Enums"]["cabin_service"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string
          fee_bps?: number
          is_enabled?: boolean
          label?: string
          max_amount_xof?: number
          min_amount_xof?: number
          provider_code?: string | null
          service?: Database["public"]["Enums"]["cabin_service"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cabin_service_settings_provider_code_fkey"
            columns: ["provider_code"]
            isOneToOne: false
            referencedRelation: "cabin_providers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cabin_service_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cabin_transfer_routes: {
        Row: {
          is_enabled: boolean
          note: string | null
          provider_code: string | null
          source_code: string
          target_code: string
          updated_at: string
        }
        Insert: {
          is_enabled?: boolean
          note?: string | null
          provider_code?: string | null
          source_code: string
          target_code: string
          updated_at?: string
        }
        Update: {
          is_enabled?: boolean
          note?: string | null
          provider_code?: string | null
          source_code?: string
          target_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cabin_transfer_routes_provider_code_fkey"
            columns: ["provider_code"]
            isOneToOne: false
            referencedRelation: "cabin_providers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cabin_transfer_routes_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "cabin_networks"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cabin_transfer_routes_target_code_fkey"
            columns: ["target_code"]
            isOneToOne: false
            referencedRelation: "cabin_networks"
            referencedColumns: ["code"]
          },
        ]
      }
      candidate_profiles: {
        Row: {
          available: boolean
          contact_email: string | null
          contact_phone: string | null
          domains: string[]
          experience: string | null
          headline: string
          neighborhood_id: string | null
          share_contact: boolean
          skills: string[]
          summary: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          available?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          domains?: string[]
          experience?: string | null
          headline: string
          neighborhood_id?: string | null
          share_contact?: boolean
          skills?: string[]
          summary?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          available?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          domains?: string[]
          experience?: string | null
          headline?: string
          neighborhood_id?: string | null
          share_contact?: boolean
          skills?: string[]
          summary?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          attribute_fields: string[] | null
          attribute_schema: string | null
          content_types: Database["public"]["Enums"]["content_type"][]
          created_at: string
          description: string | null
          family: Database["public"]["Enums"]["category_family"]
          icon: string | null
          id: string
          is_active: boolean
          keywords: string[]
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          attribute_fields?: string[] | null
          attribute_schema?: string | null
          content_types?: Database["public"]["Enums"]["content_type"][]
          created_at?: string
          description?: string | null
          family: Database["public"]["Enums"]["category_family"]
          icon?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          attribute_fields?: string[] | null
          attribute_schema?: string | null
          content_types?: Database["public"]["Enums"]["content_type"][]
          created_at?: string
          description?: string | null
          family?: Database["public"]["Enums"]["category_family"]
          icon?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[]
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      charter_acceptances: {
        Row: {
          accepted_at: string
          role: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          role: string
          user_id?: string
          version: string
        }
        Update: {
          accepted_at?: string
          role?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "charter_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          center: unknown
          country_code: string
          created_at: string
          default_zoom: number
          id: string
          is_active: boolean
          is_default: boolean
          launch_status: Database["public"]["Enums"]["city_launch_status"]
          name: string
          region: string | null
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          center?: unknown
          country_code?: string
          created_at?: string
          default_zoom?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          launch_status?: Database["public"]["Enums"]["city_launch_status"]
          name: string
          region?: string | null
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          center?: unknown
          country_code?: string
          created_at?: string
          default_zoom?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          launch_status?: Database["public"]["Enums"]["city_launch_status"]
          name?: string
          region?: string | null
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          created_at: string
          document_version: string
          granted: boolean
          id: string
          kind: Database["public"]["Enums"]["consent_kind"]
          user_id: string
        }
        Insert: {
          created_at?: string
          document_version: string
          granted: boolean
          id?: string
          kind: Database["public"]["Enums"]["consent_kind"]
          user_id: string
        }
        Update: {
          created_at?: string
          document_version?: string
          granted?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["consent_kind"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          business_id: string | null
          consented_at: string | null
          created_at: string
          details: Json
          event_id: string | null
          id: string
          kind: Database["public"]["Enums"]["contact_request_kind"]
          listing_id: string | null
          message: string
          place_id: string | null
          recipient_id: string
          sender_email: string | null
          sender_id: string | null
          sender_name: string
          sender_phone: string | null
          status: Database["public"]["Enums"]["contact_request_status"]
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          consented_at?: string | null
          created_at?: string
          details?: Json
          event_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["contact_request_kind"]
          listing_id?: string | null
          message: string
          place_id?: string | null
          recipient_id: string
          sender_email?: string | null
          sender_id?: string | null
          sender_name: string
          sender_phone?: string | null
          status?: Database["public"]["Enums"]["contact_request_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          consented_at?: string | null
          created_at?: string
          details?: Json
          event_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["contact_request_kind"]
          listing_id?: string | null
          message?: string
          place_id?: string | null
          recipient_id?: string
          sender_email?: string | null
          sender_id?: string | null
          sender_name?: string
          sender_phone?: string | null
          status?: Database["public"]["Enums"]["contact_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_reveals: {
        Row: {
          channel: string
          created_at: string
          id: number
          listing_id: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: never
          listing_id: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: never
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_reveals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_reveals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_revisions: {
        Row: {
          action: Database["public"]["Enums"]["revision_action"]
          after: Json | null
          before: Json | null
          changed_at: string
          changed_by: string | null
          entity_id: string
          entity_type: string
          id: number
          reason: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["revision_action"]
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          entity_id: string
          entity_type: string
          id?: never
          reason?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["revision_action"]
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: never
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_revisions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          is_archived: boolean
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          is_archived?: boolean
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          is_archived?: boolean
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          business_id: string | null
          created_at: string
          created_by: string
          event_id: string | null
          id: string
          last_message_at: string | null
          listing_id: string | null
          place_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          created_by: string
          event_id?: string | null
          id?: string
          last_message_at?: string | null
          listing_id?: string | null
          place_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          created_by?: string
          event_id?: string | null
          id?: string
          last_message_at?: string | null
          listing_id?: string | null
          place_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          event_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address_text: string | null
          business_id: string | null
          category_id: string
          city_id: string
          contact_email: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          created_at: string
          description: string
          ends_at: string | null
          id: string
          is_free: boolean
          location: unknown
          location_precision: Database["public"]["Enums"]["location_precision"]
          neighborhood_id: string | null
          organization_id: string | null
          organizer_id: string
          organizer_name: string | null
          original_starts_at: string | null
          place_id: string | null
          price_max: number | null
          price_min: number | null
          published_at: string | null
          rejection_reason: string | null
          schedule_note: string | null
          schedule_status: Database["public"]["Enums"]["event_schedule_status"]
          search_vector: unknown
          slug: string
          source_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["content_status"]
          ticket_url: string | null
          title: string
          updated_at: string
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          address_text?: string | null
          business_id?: string | null
          category_id: string
          city_id: string
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          description: string
          ends_at?: string | null
          id?: string
          is_free?: boolean
          location?: unknown
          location_precision?: Database["public"]["Enums"]["location_precision"]
          neighborhood_id?: string | null
          organization_id?: string | null
          organizer_id: string
          organizer_name?: string | null
          original_starts_at?: string | null
          place_id?: string | null
          price_max?: number | null
          price_min?: number | null
          published_at?: string | null
          rejection_reason?: string | null
          schedule_note?: string | null
          schedule_status?: Database["public"]["Enums"]["event_schedule_status"]
          search_vector?: unknown
          slug: string
          source_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["content_status"]
          ticket_url?: string | null
          title: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          address_text?: string | null
          business_id?: string | null
          category_id?: string
          city_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          is_free?: boolean
          location?: unknown
          location_precision?: Database["public"]["Enums"]["location_precision"]
          neighborhood_id?: string | null
          organization_id?: string | null
          organizer_id?: string
          organizer_name?: string | null
          original_starts_at?: string | null
          place_id?: string | null
          price_max?: number | null
          price_min?: number | null
          published_at?: string | null
          rejection_reason?: string | null
          schedule_note?: string | null
          schedule_status?: Database["public"]["Enums"]["event_schedule_status"]
          search_vector?: unknown
          slug?: string
          source_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["content_status"]
          ticket_url?: string | null
          title?: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          business_id: string | null
          created_at: string
          event_id: string | null
          id: string
          listing_id: string | null
          place_id: string | null
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          listing_id?: string | null
          place_id?: string | null
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          listing_id?: string | null
          place_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_article_versions: {
        Row: {
          article_id: string
          body: string
          change_note: string | null
          created_at: string
          edited_by: string | null
          id: number
          summary: string | null
          title: string
          version: number
        }
        Insert: {
          article_id: string
          body: string
          change_note?: string | null
          created_at?: string
          edited_by?: string | null
          id?: never
          summary?: string | null
          title: string
          version: number
        }
        Update: {
          article_id?: string
          body?: string
          change_note?: string | null
          created_at?: string
          edited_by?: string | null
          id?: never
          summary?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "guide_article_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "guide_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_article_versions_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_articles: {
        Row: {
          author_id: string | null
          body: string
          city_id: string
          created_at: string
          id: string
          published_at: string | null
          search_vector: unknown
          section_id: string
          slug: string
          source_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          summary: string | null
          title: string
          updated_at: string
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
          version: number
        }
        Insert: {
          author_id?: string | null
          body: string
          city_id: string
          created_at?: string
          id?: string
          published_at?: string | null
          search_vector?: unknown
          section_id: string
          slug: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Update: {
          author_id?: string | null
          body?: string
          city_id?: string
          created_at?: string
          id?: string
          published_at?: string | null
          search_vector?: unknown
          section_id?: string
          slug?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title?: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "guide_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_articles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_articles_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "guide_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_articles_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_articles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_sections: {
        Row: {
          category_slugs: string[]
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_slugs?: string[]
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_slugs?: string[]
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      guide_suggestions: {
        Row: {
          article_id: string
          created_at: string
          handled_by: string | null
          id: string
          message: string
          resolution_note: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          handled_by?: string | null
          id?: string
          message: string
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          handled_by?: string | null
          id?: string
          message?: string
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_suggestions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "guide_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_suggestions_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          alt_text: string | null
          bucket: string
          business_id: string | null
          byte_size: number | null
          content_hash: string | null
          created_at: string
          event_id: string | null
          height: number | null
          id: string
          listing_id: string | null
          owner_id: string
          place_id: string | null
          sort_order: number
          storage_path: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bucket?: string
          business_id?: string | null
          byte_size?: number | null
          content_hash?: string | null
          created_at?: string
          event_id?: string | null
          height?: number | null
          id?: string
          listing_id?: string | null
          owner_id: string
          place_id?: string | null
          sort_order?: number
          storage_path: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bucket?: string
          business_id?: string | null
          byte_size?: number | null
          content_hash?: string | null
          created_at?: string
          event_id?: string | null
          height?: number | null
          id?: string
          listing_id?: string | null
          owner_id?: string
          place_id?: string | null
          sort_order?: number
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "images_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "images_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "images_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applicant_id: string
          created_at: string
          cv_path: string | null
          id: string
          listing_id: string
          message: string
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          cv_path?: string | null
          id?: string
          listing_id: string
          message: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          cv_path?: string | null
          id?: string
          listing_id?: string
          message?: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          document_id: string
          embedding: string | null
          embedding_model: string | null
          id: string
          search_vector: unknown
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          document_id: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          search_vector?: unknown
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          document_id?: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          search_vector?: unknown
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          city_id: string | null
          content: string
          content_hash: string
          entity_id: string | null
          entity_type: string
          id: string
          source_id: string | null
          title: string
          updated_at: string
          url_path: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
        }
        Insert: {
          city_id?: string | null
          content: string
          content_hash: string
          entity_id?: string | null
          entity_type: string
          id?: string
          source_id?: string | null
          title: string
          updated_at?: string
          url_path?: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
        }
        Update: {
          city_id?: string | null
          content?: string
          content_hash?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          source_id?: string | null
          title?: string
          updated_at?: string
          url_path?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          hidden_reason: string | null
          id: string
          listing_id: string
          parent_id: string | null
          status: Database["public"]["Enums"]["comment_status"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          hidden_reason?: string | null
          id?: string
          listing_id: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["comment_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          hidden_reason?: string | null
          id?: string
          listing_id?: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["comment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "listing_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_likes: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_likes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_suggestions: {
        Row: {
          confidence: number
          created_at: string
          decided_at: string | null
          excerpt: string | null
          field: string
          id: string
          input_kind: string
          listing_id: string
          model: string | null
          origin: string
          previous_value: Json | null
          status: string
          user_id: string
          value: Json
        }
        Insert: {
          confidence: number
          created_at?: string
          decided_at?: string | null
          excerpt?: string | null
          field: string
          id?: string
          input_kind: string
          listing_id: string
          model?: string | null
          origin: string
          previous_value?: Json | null
          status?: string
          user_id?: string
          value: Json
        }
        Update: {
          confidence?: number
          created_at?: string
          decided_at?: string | null
          excerpt?: string | null
          field?: string
          id?: string
          input_kind?: string
          listing_id?: string
          model?: string | null
          origin?: string
          previous_value?: Json | null
          status?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "listing_suggestions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_view_counts: {
        Row: {
          listing_id: string
          updated_at: string
          views: number
        }
        Insert: {
          listing_id: string
          updated_at?: string
          views?: number
        }
        Update: {
          listing_id?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_view_counts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_view_marks: {
        Row: {
          day: string
          listing_id: string
          viewer_hash: string
        }
        Insert: {
          day?: string
          listing_id: string
          viewer_hash: string
        }
        Update: {
          day?: string
          listing_id?: string
          viewer_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_view_marks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address_text: string | null
          attributes: Json
          availability_status: Database["public"]["Enums"]["availability_status"]
          available_from: string | null
          business_id: string | null
          category_id: string
          city_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          created_at: string
          currency: string
          description: string
          expires_at: string | null
          id: string
          is_negotiable: boolean
          last_confirmed_at: string | null
          location: unknown
          location_precision: Database["public"]["Enums"]["location_precision"]
          location_public: unknown
          neighborhood_id: string | null
          organization_id: string | null
          owner_id: string
          price: number | null
          price_unit: Database["public"]["Enums"]["price_unit"] | null
          public_location_precision: Database["public"]["Enums"]["public_location_precision"]
          published_at: string | null
          rejection_reason: string | null
          search_vector: unknown
          show_email: boolean
          show_phone: boolean
          show_whatsapp: boolean
          slug: string
          source_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
          view_count: number
        }
        Insert: {
          address_text?: string | null
          attributes?: Json
          availability_status?: Database["public"]["Enums"]["availability_status"]
          available_from?: string | null
          business_id?: string | null
          category_id: string
          city_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          currency?: string
          description: string
          expires_at?: string | null
          id?: string
          is_negotiable?: boolean
          last_confirmed_at?: string | null
          location?: unknown
          location_precision?: Database["public"]["Enums"]["location_precision"]
          location_public?: unknown
          neighborhood_id?: string | null
          organization_id?: string | null
          owner_id: string
          price?: number | null
          price_unit?: Database["public"]["Enums"]["price_unit"] | null
          public_location_precision?: Database["public"]["Enums"]["public_location_precision"]
          published_at?: string | null
          rejection_reason?: string | null
          search_vector?: unknown
          show_email?: boolean
          show_phone?: boolean
          show_whatsapp?: boolean
          slug: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          view_count?: number
        }
        Update: {
          address_text?: string | null
          attributes?: Json
          availability_status?: Database["public"]["Enums"]["availability_status"]
          available_from?: string | null
          business_id?: string | null
          category_id?: string
          city_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          currency?: string
          description?: string
          expires_at?: string | null
          id?: string
          is_negotiable?: boolean
          last_confirmed_at?: string | null
          location?: unknown
          location_precision?: Database["public"]["Enums"]["location_precision"]
          location_public?: unknown
          neighborhood_id?: string | null
          organization_id?: string | null
          owner_id?: string
          price?: number | null
          price_unit?: Database["public"]["Enums"]["price_unit"] | null
          public_location_precision?: Database["public"]["Enums"]["public_location_precision"]
          published_at?: string | null
          rejection_reason?: string | null
          search_vector?: unknown
          show_email?: boolean
          show_phone?: boolean
          show_whatsapp?: boolean
          slug?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhood_boundaries: {
        Row: {
          geometry: unknown
          id: string
          neighborhood_id: string
          note: string | null
          proposed_at: string
          proposed_by: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          status: string
        }
        Insert: {
          geometry: unknown
          id?: string
          neighborhood_id: string
          note?: string | null
          proposed_at?: string
          proposed_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: string
        }
        Update: {
          geometry?: unknown
          id?: string
          neighborhood_id?: string
          note?: string | null
          proposed_at?: string
          proposed_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "neighborhood_boundaries_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhood_boundaries_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhood_boundaries_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhood_boundaries_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          alt_names: string[]
          boundary: unknown
          boundary_validated_at: string | null
          center: unknown
          city_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          source_id: string | null
          steward_id: string | null
          updated_at: string
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          alt_names?: string[]
          boundary?: unknown
          boundary_validated_at?: string | null
          center?: unknown
          city_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          source_id?: string | null
          steward_id?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          alt_names?: string[]
          boundary?: unknown
          boundary_validated_at?: string | null
          center?: unknown
          city_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          source_id?: string | null
          steward_id?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhoods_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhoods_steward_id_fkey"
            columns: ["steward_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neighborhoods_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newcomer_plans: {
        Row: {
          answers: Json
          plan: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          plan?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          plan?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newcomer_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          notification_id: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          organization_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["organization_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          organization_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["organization_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["organization_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          city_id: string
          created_at: string
          created_by: string | null
          id: string
          is_suspended: boolean
          kind: Database["public"]["Enums"]["organization_kind"]
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          city_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_suspended?: boolean
          kind?: Database["public"]["Enums"]["organization_kind"]
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          city_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_suspended?: boolean
          kind?: Database["public"]["Enums"]["organization_kind"]
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_xof: number
          campaign_id: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          id: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_payload: Json | null
          provider_reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_xof: number
          campaign_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_payload?: Json | null
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_xof?: number
          campaign_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_payload?: Json | null
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sponsored_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_claims: {
        Row: {
          business_id: string | null
          claimant_id: string
          claimant_role: string
          created_at: string
          decision_note: string | null
          evidence: string
          id: string
          message: string
          phone: string
          place_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          business_id?: string | null
          claimant_id: string
          claimant_role: string
          created_at?: string
          decision_note?: string | null
          evidence: string
          id?: string
          message: string
          phone: string
          place_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          business_id?: string | null
          claimant_id?: string
          claimant_role?: string
          created_at?: string
          decision_note?: string | null
          evidence?: string
          id?: string
          message?: string
          phone?: string
          place_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_claims_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_claims_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_claims_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_likes: {
        Row: {
          created_at: string
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_likes_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          access_conditions: string | null
          accessibility: string[]
          address_text: string | null
          ambiance: string[]
          audiences: string[]
          business_id: string | null
          category_id: string
          city_id: string
          created_at: string
          created_by: string | null
          description: string | null
          email: string | null
          features: string[]
          id: string
          kind: Database["public"]["Enums"]["place_kind"]
          location: unknown
          location_precision: Database["public"]["Enums"]["location_precision"]
          manager_id: string | null
          merged_into: string | null
          name: string
          neighborhood_id: string | null
          opening_hours: Json | null
          opening_hours_source_id: string | null
          opening_hours_verified_at: string | null
          organization_id: string | null
          phone: string | null
          price_level: number | null
          products: string[]
          published_at: string | null
          rejection_reason: string | null
          search_vector: unknown
          slug: string
          source_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          summary: string | null
          themes: string[]
          updated_at: string
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
          visit_duration: string | null
          warnings: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          access_conditions?: string | null
          accessibility?: string[]
          address_text?: string | null
          ambiance?: string[]
          audiences?: string[]
          business_id?: string | null
          category_id: string
          city_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          features?: string[]
          id?: string
          kind: Database["public"]["Enums"]["place_kind"]
          location?: unknown
          location_precision?: Database["public"]["Enums"]["location_precision"]
          manager_id?: string | null
          merged_into?: string | null
          name: string
          neighborhood_id?: string | null
          opening_hours?: Json | null
          opening_hours_source_id?: string | null
          opening_hours_verified_at?: string | null
          organization_id?: string | null
          phone?: string | null
          price_level?: number | null
          products?: string[]
          published_at?: string | null
          rejection_reason?: string | null
          search_vector?: unknown
          slug: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          themes?: string[]
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          visit_duration?: string | null
          warnings?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          access_conditions?: string | null
          accessibility?: string[]
          address_text?: string | null
          ambiance?: string[]
          audiences?: string[]
          business_id?: string | null
          category_id?: string
          city_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          features?: string[]
          id?: string
          kind?: Database["public"]["Enums"]["place_kind"]
          location?: unknown
          location_precision?: Database["public"]["Enums"]["location_precision"]
          manager_id?: string | null
          merged_into?: string | null
          name?: string
          neighborhood_id?: string | null
          opening_hours?: Json | null
          opening_hours_source_id?: string | null
          opening_hours_verified_at?: string | null
          organization_id?: string | null
          phone?: string | null
          price_level?: number | null
          products?: string[]
          published_at?: string | null
          rejection_reason?: string | null
          search_vector?: unknown
          slug?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          themes?: string[]
          updated_at?: string
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          visit_duration?: string | null
          warnings?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_opening_hours_source_id_fkey"
            columns: ["opening_hours_source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_period: Database["public"]["Enums"]["billing_period"]
          code: string
          created_at: string
          description: string | null
          features: string[]
          id: string
          is_active: boolean
          limits: Json
          name: string
          price_xof: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          code: string
          created_at?: string
          description?: string | null
          features?: string[]
          id?: string
          is_active?: boolean
          limits?: Json
          name: string
          price_xof?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          code?: string
          created_at?: string
          description?: string | null
          features?: string[]
          id?: string
          is_active?: boolean
          limits?: Json
          name?: string
          price_xof?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_city_id: string | null
          display_name: string | null
          id: string
          is_suspended: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_city_id?: string | null
          display_name?: string | null
          id: string
          is_suspended?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_city_id?: string | null
          display_name?: string | null
          id?: string
          is_suspended?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_city_id_fkey"
            columns: ["default_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          hits: number
          key_hash: string
          window_start: string
        }
        Insert: {
          hits: number
          key_hash: string
          window_start: string
        }
        Update: {
          hits?: number
          key_hash?: string
          window_start?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          article_id: string | null
          business_id: string | null
          comment_id: string | null
          created_at: string
          details: string | null
          event_id: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          listing_id: string | null
          message_id: string | null
          place_id: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string | null
          resolution_note: string | null
          review_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          article_id?: string | null
          business_id?: string | null
          comment_id?: string | null
          created_at?: string
          details?: string | null
          event_id?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          listing_id?: string | null
          message_id?: string | null
          place_id?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string | null
          resolution_note?: string | null
          review_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          article_id?: string | null
          business_id?: string | null
          comment_id?: string | null
          created_at?: string
          details?: string | null
          event_id?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          listing_id?: string | null
          message_id?: string | null
          place_id?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string | null
          resolution_note?: string | null
          review_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "guide_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "listing_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string
          body: string | null
          business_id: string | null
          created_at: string
          id: string
          place_id: string | null
          rating: number
          response_at: string | null
          response_body: string | null
          response_by: string | null
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          place_id?: string | null
          rating: number
          response_at?: string | null
          response_body?: string | null
          response_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          place_id?: string | null
          rating?: number
          response_at?: string | null
          response_body?: string | null
          response_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_response_by_fkey"
            columns: ["response_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          alert_frequency: string
          created_at: string
          id: string
          last_alerted_at: string | null
          name: string
          query: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_frequency?: string
          created_at?: string
          id?: string
          last_alerted_at?: string | null
          name: string
          query: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_frequency?: string
          created_at?: string
          id?: string
          last_alerted_at?: string | null
          name?: string
          query?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_stats: {
        Row: {
          city_id: string
          day: string
          query_norm: string
          search_type: string
          searches: number
          zero_results: number
        }
        Insert: {
          city_id: string
          day?: string
          query_norm: string
          search_type: string
          searches?: number
          zero_results?: number
        }
        Update: {
          city_id?: string
          day?: string
          query_norm?: string
          search_type?: string
          searches?: number
          zero_results?: number
        }
        Relationships: [
          {
            foreignKeyName: "search_stats_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          collected_at: string
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["source_kind"]
          publisher: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          collected_at: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["source_kind"]
          publisher?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          collected_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["source_kind"]
          publisher?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_campaigns: {
        Row: {
          budget_xof: number
          business_id: string | null
          category_id: string | null
          city_id: string
          clicks: number
          created_at: string
          ends_at: string
          event_id: string | null
          id: string
          impressions: number
          listing_id: string | null
          organization_id: string | null
          owner_id: string | null
          place_id: string | null
          placement: Database["public"]["Enums"]["campaign_placement"]
          starts_at: string
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          budget_xof: number
          business_id?: string | null
          category_id?: string | null
          city_id: string
          clicks?: number
          created_at?: string
          ends_at: string
          event_id?: string | null
          id?: string
          impressions?: number
          listing_id?: string | null
          organization_id?: string | null
          owner_id?: string | null
          place_id?: string | null
          placement: Database["public"]["Enums"]["campaign_placement"]
          starts_at: string
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          budget_xof?: number
          business_id?: string | null
          category_id?: string | null
          city_id?: string
          clicks?: number
          created_at?: string
          ends_at?: string
          event_id?: string | null
          id?: string
          impressions?: number
          listing_id?: string | null
          organization_id?: string | null
          owner_id?: string | null
          place_id?: string | null
          placement?: Database["public"]["Enums"]["campaign_placement"]
          starts_at?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaigns_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaigns_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaigns_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaigns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_campaigns_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          business_id: string | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string | null
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string | null
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string | null
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id?: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          auth_secret: string | null
          created_at: string
          endpoint: string
          id: string
          kind: string
          last_seen_at: string
          p256dh: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_secret?: string | null
          created_at?: string
          endpoint: string
          id?: string
          kind?: string
          last_seen_at?: string
          p256dh?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_secret?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          kind?: string
          last_seen_at?: string
          p256dh?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          account_intent: string
          locale: string
          notification_channels: Json
          pending_business_category: string | null
          pending_business_name: string | null
          search_indexing: boolean
          show_listing_count: boolean
          show_member_since: boolean
          show_public_name: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_intent?: string
          locale?: string
          notification_channels?: Json
          pending_business_category?: string | null
          pending_business_name?: string | null
          search_indexing?: boolean
          show_listing_count?: boolean
          show_member_since?: boolean
          show_public_name?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_intent?: string
          locale?: string
          notification_channels?: Json
          pending_business_category?: string | null
          pending_business_name?: string | null
          search_indexing?: boolean
          show_listing_count?: boolean
          show_member_since?: boolean
          show_public_name?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_pending_business_category_fkey"
            columns: ["pending_business_category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      account_can_review: { Args: { p_user: string }; Returns: boolean }
      admin_accounts: {
        Args: {
          p_query?: string
          p_role?: Database["public"]["Enums"]["user_role"]
          p_suspended?: boolean
        }
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          is_suspended: boolean
          last_sign_in_at: string
          listings: number
          organizations: number
          reports_against: number
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      admin_appeals: {
        Args: { p_pending?: boolean }
        Returns: {
          author_name: string
          created_at: string
          decided_at: string
          decision_note: string
          id: string
          message: string
          status: string
          target_id: string
          target_type: string
          title: string
          user_id: string
        }[]
      }
      admin_audit_entries: {
        Args: { p_action?: string; p_limit?: number }
        Returns: {
          action: string
          actor_id: string
          actor_name: string
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: number
        }[]
      }
      admin_category_usage: {
        Args: never
        Returns: {
          businesses: number
          category_id: string
          children: number
          events: number
          listings_other: number
          listings_published: number
          places: number
        }[]
      }
      admin_organizations: {
        Args: { p_query?: string }
        Returns: {
          created_at: string
          id: string
          is_suspended: boolean
          kind: Database["public"]["Enums"]["organization_kind"]
          listings: number
          members: number
          name: string
          pages: number
          slug: string
        }[]
      }
      admin_overview: { Args: never; Returns: Json }
      admin_reports: {
        Args: { p_open?: boolean }
        Returns: {
          created_at: string
          details: string
          handled_at: string
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          resolution_note: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_owner: string
          target_parent_slug: string
          target_parent_type: string
          target_reports: number
          target_slug: string
          target_status: string
          target_title: string
          target_type: string
        }[]
      }
      admin_revisions: {
        Args: { p_entity_id?: string; p_entity_type?: string; p_limit?: number }
        Returns: {
          action: Database["public"]["Enums"]["revision_action"]
          after: Json
          author_name: string
          before: Json
          changed_at: string
          changed_by: string
          entity_id: string
          entity_type: string
          id: number
          reason: string
        }[]
      }
      admin_set_account: {
        Args: {
          p_reason?: string
          p_role?: Database["public"]["Enums"]["user_role"]
          p_suspended?: boolean
          p_user: string
        }
        Returns: undefined
      }
      admin_set_campaign_status: {
        Args: {
          p_campaign: string
          p_reason: string
          p_status: Database["public"]["Enums"]["campaign_status"]
        }
        Returns: undefined
      }
      admin_set_organization: {
        Args: { p_organization: string; p_reason: string; p_suspended: boolean }
        Returns: undefined
      }
      ai_month_cost: { Args: never; Returns: number }
      ai_usage_summary: {
        Args: never
        Returns: {
          calls: number
          cost_usd: number
          feature: string
          input_tokens: number
          output_tokens: number
        }[]
      }
      appeal_target_state: {
        Args: { p_id: string; p_type: string }
        Returns: {
          contestable: boolean
          owner_id: string
          title: string
        }[]
      }
      archive_past_events: { Args: never; Returns: number }
      attr_bool: {
        Args: { p_attributes: Json; p_key: string }
        Returns: boolean
      }
      attr_int: { Args: { p_attributes: Json; p_key: string }; Returns: number }
      backoffice_mfa_required: { Args: never; Returns: boolean }
      become_individual: { Args: never; Returns: undefined }
      become_professional: { Args: never; Returns: undefined }
      business_private_location: {
        Args: { p_business: string }
        Returns: {
          address_text: string
          latitude: number
          longitude: number
        }[]
      }
      business_public_badges: {
        Args: { p_ids: string[] }
        Returns: {
          business_id: string
          sponsored: boolean
          verification_pending: boolean
        }[]
      }
      business_public_point: {
        Args: { p_business: string }
        Returns: {
          lat: number
          lng: number
          location_precision: Database["public"]["Enums"]["public_location_precision"]
        }[]
      }
      business_rating: {
        Args: { p_business: string }
        Returns: {
          average: number
          review_count: number
        }[]
      }
      business_reviews: {
        Args: { p_business: string; p_limit?: number; p_offset?: number }
        Returns: {
          author_name: string
          body: string
          created_at: string
          id: string
          rating: number
          response_at: string
          response_body: string
        }[]
      }
      cabin_fee: { Args: { p_amount: number; p_bps: number }; Returns: number }
      cabin_operation_status: {
        Args: { p_reference: string; p_token_hash: string }
        Returns: {
          amount_xof: number
          created_at: string
          delivery_code: string
          mode: Database["public"]["Enums"]["cabin_mode"]
          provider_fee_xof: number
          recipient_masked: string
          reference: string
          service: Database["public"]["Enums"]["cabin_service"]
          service_fee_xof: number
          status: Database["public"]["Enums"]["cabin_status"]
          status_reason: string
          total_xof: number
          updated_at: string
        }[]
      }
      cabin_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["cabin_status"]
          p_to: Database["public"]["Enums"]["cabin_status"]
        }
        Returns: boolean
      }
      can_manage_content: {
        Args: { p_organization: string; p_owner: string }
        Returns: boolean
      }
      can_manage_private_media: { Args: { p_path: string }; Returns: boolean }
      category_content_counts: {
        Args: { p_city: string; p_slugs: string[] }
        Returns: {
          slug: string
          total: number
        }[]
      }
      change_event_schedule: {
        Args: {
          p_action: string
          p_ends_at?: string
          p_event: string
          p_note: string
          p_starts_at?: string
        }
        Returns: undefined
      }
      chunk_text: {
        Args: { p_max?: number; p_text: string }
        Returns: string[]
      }
      claim_notification_deliveries: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          body: string
          channel: string
          created_at: string
          delivery_id: string
          display_name: string
          email: string
          link: string
          notification_id: string
          title: string
          type: string
          user_id: string
        }[]
      }
      clear_neighborhood_boundary: {
        Args: { p_neighborhood: string; p_note: string }
        Returns: undefined
      }
      complete_notification_delivery: {
        Args: { p_delivery: string; p_error?: string; p_status: string }
        Returns: undefined
      }
      confirm_listing: { Args: { p_listing: string }; Returns: string }
      consume_rate_limit: {
        Args: { p_key_hash: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      contains_contact_details: { Args: { p_text: string }; Returns: boolean }
      content_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["content_status"]
          p_is_owner: boolean
          p_is_staff: boolean
          p_to: Database["public"]["Enums"]["content_status"]
        }
        Returns: boolean
      }
      conversation_header: {
        Args: { p_conversation: string }
        Returns: {
          event_slug: string
          event_title: string
          listing_active: boolean
          listing_id: string
          listing_slug: string
          listing_title: string
          other_id: string
          other_name: string
          place_name: string
          place_slug: string
        }[]
      }
      create_cabin_operation: {
        Args: {
          p_amount: number
          p_expected_total: number
          p_follow_token_hash: string
          p_idempotency_key: string
          p_live_available: boolean
          p_network: string
          p_offer: string
          p_quote_expires_at: string
          p_recipient_fingerprint: string
          p_recipient_masked: string
          p_service: Database["public"]["Enums"]["cabin_service"]
          p_target_network: string
          p_user: string
        }
        Returns: {
          created: boolean
          id: string
          mode: Database["public"]["Enums"]["cabin_mode"]
          reference: string
          status: Database["public"]["Enums"]["cabin_status"]
          total_xof: number
        }[]
      }
      create_organization_invitation: {
        Args: {
          p_organization: string
          p_role: Database["public"]["Enums"]["organization_role"]
        }
        Returns: string
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      decide_appeal: {
        Args: { p_accept: boolean; p_appeal: string; p_note: string }
        Returns: undefined
      }
      decide_business_verification: {
        Args: {
          p_approve: boolean
          p_note?: string
          p_request: string
          p_source_title: string
        }
        Returns: undefined
      }
      delete_category: {
        Args: { p_category: string; p_move_to: string; p_reason: string }
        Returns: number
      }
      demo_content_public: { Args: never; Returns: boolean }
      event_point: {
        Args: { p_event: string }
        Returns: {
          lat: number
          lng: number
          location_precision: Database["public"]["Enums"]["location_precision"]
        }[]
      }
      expire_cabin_operations: { Args: never; Returns: number }
      expire_listings: { Args: never; Returns: number }
      export_my_data: { Args: never; Returns: Json }
      fraud_review_queue: {
        Args: never
        Returns: {
          created_at: string
          listing_id: string
          owner_id: string
          score: number
          signals: Json
          slug: string
          status: string
          title: string
        }[]
      }
      fraud_signals_for: {
        Args: { p_listing: string }
        Returns: {
          code: string
          label: string
          weight: number
        }[]
      }
      grant_public_columns: {
        Args: { p_hidden: string[]; p_table: string }
        Returns: undefined
      }
      guide_article_credits: {
        Args: { p_article: string }
        Returns: {
          author_name: string
          source_collected_at: string
          source_publisher: string
          source_title: string
          source_url: string
          verifier_name: string
        }[]
      }
      guide_article_history: {
        Args: { p_article: string }
        Returns: {
          change_note: string
          created_at: string
          version: number
        }[]
      }
      handle_report: {
        Args: { p_decision: string; p_note?: string; p_report: string }
        Returns: undefined
      }
      immutable_unaccent: { Args: { input: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_conversation_participant: {
        Args: { p_conversation: string }
        Returns: boolean
      }
      is_curator: { Args: never; Returns: boolean }
      is_employer: { Args: never; Returns: boolean }
      is_org_member: {
        Args: {
          p_min_role?: Database["public"]["Enums"]["organization_role"]
          p_organization: string
        }
        Returns: boolean
      }
      is_page_manager: { Args: { p_business: string }; Returns: boolean }
      is_page_member: { Args: { p_business: string }; Returns: boolean }
      is_service_context: { Args: never; Returns: boolean }
      is_service_request: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      is_suspended: { Args: never; Returns: boolean }
      itinerary_candidates: {
        Args: { p_categories: string[]; p_city: string }
        Returns: {
          accessibility: string[]
          audiences: string[]
          category_slug: string
          id: string
          lat: number
          lng: number
          name: string
          price_level: number
          slug: string
          themes: string[]
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string
          visit_duration: string
          warnings: string
        }[]
      }
      listing_comment_thread: {
        Args: { p_listing: string }
        Returns: {
          author_name: string
          body: string
          created_at: string
          id: string
          is_mine: boolean
          is_seller: boolean
          parent_id: string
        }[]
      }
      listing_editor_point: {
        Args: { p_listing: string }
        Returns: {
          lat: number
          lng: number
        }[]
      }
      listing_engagement: {
        Args: { p_listing: string }
        Returns: {
          comments: number
          liked: boolean
          likes: number
          views: number
        }[]
      }
      listing_fraud_signals: {
        Args: { p_listing: string }
        Returns: {
          code: string
          label: string
          weight: number
        }[]
      }
      listing_image_duplicates: {
        Args: { p_listing: string }
        Returns: {
          image_id: string
          other_matches: number
          own_matches: number
        }[]
      }
      listing_is_contactable: { Args: { p_listing: string }; Returns: boolean }
      listing_is_manageable: { Args: { p_listing: string }; Returns: boolean }
      listing_is_public: { Args: { p_listing: string }; Returns: boolean }
      listing_private_fields: {
        Args: { p_listing: string }
        Returns: {
          address_text: string
          contact_email: string
          contact_phone: string
          contact_whatsapp: string
          latitude: number
          longitude: number
        }[]
      }
      listing_public_point: {
        Args: { p_listing: string }
        Returns: {
          lat: number
          lng: number
          location_precision: Database["public"]["Enums"]["public_location_precision"]
        }[]
      }
      listing_public_state: {
        Args: { p_slug: string }
        Returns: {
          category_id: string
          city_id: string
          listing_id: string
          state: string
          title: string
        }[]
      }
      listing_schema: { Args: { p_category: string }; Returns: string }
      listing_seller: {
        Args: { p_listing: string }
        Returns: {
          active_listings: number
          avatar_url: string
          display_name: string
          is_professional: boolean
          member_since: string
          organization_name: string
        }[]
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id: string
          p_entity_type: string
        }
        Returns: undefined
      }
      map_features: {
        Args: {
          p_city: string
          p_east?: number
          p_layers: string[]
          p_limit?: number
          p_neighborhood?: string
          p_north?: number
          p_south?: number
          p_west?: number
        }
        Returns: {
          category: string
          id: string
          lat: number
          layer: string
          lng: number
          location_precision: string
          neighborhood: string
          slug: string
          starts_at: string
          title: string
          total_count: number
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string
        }[]
      }
      member_allows_indexing: { Args: { p_user: string }; Returns: boolean }
      member_privacy: {
        Args: { p_user: string }
        Returns: {
          search_indexing: boolean
          show_listing_count: boolean
          show_member_since: boolean
          show_public_name: boolean
        }[]
      }
      merge_places: {
        Args: { p_duplicate: string; p_keep: string; p_reason: string }
        Returns: Json
      }
      my_candidate_contact: {
        Args: never
        Returns: {
          contact_email: string
          contact_phone: string
        }[]
      }
      my_conversations: {
        Args: never
        Returns: {
          conversation_id: string
          event_slug: string
          event_title: string
          last_message: string
          last_message_at: string
          last_message_mine: boolean
          listing_slug: string
          listing_title: string
          other_name: string
          place_name: string
          place_slug: string
          unread: number
        }[]
      }
      my_listing_history: {
        Args: { p_listing: string }
        Returns: {
          action: Database["public"]["Enums"]["revision_action"]
          availability_after: string
          availability_before: string
          changed_at: string
          status_after: string
          status_before: string
        }[]
      }
      my_listing_stats: {
        Args: never
        Returns: {
          contact_reveals: number
          conversations: number
          favorites: number
          listing_id: string
          views: number
        }[]
      }
      neighborhood_boundary_geojson: {
        Args: { p_neighborhood: string }
        Returns: string
      }
      neighborhood_boundary_history: {
        Args: { p_neighborhood: string }
        Returns: {
          area_km2: number
          geojson: string
          id: string
          note: string
          proposed_at: string
          review_note: string
          reviewed_at: string
          source_title: string
          status: string
        }[]
      }
      neighborhood_overview: {
        Args: { p_city: string }
        Returns: {
          alt_names: string[]
          bounded: boolean
          id: string
          name: string
          slug: string
          total: number
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string
        }[]
      }
      neighborhood_resource_counts: {
        Args: { p_neighborhood: string }
        Returns: {
          kind: string
          total: number
        }[]
      }
      notification_category: { Args: { p_type: string }; Returns: string }
      notify_expiring_listings: { Args: never; Returns: number }
      ops_metrics: { Args: never; Returns: Json }
      organization_invitation_preview: {
        Args: { p_token: string }
        Returns: {
          organization_name: string
          role: Database["public"]["Enums"]["organization_role"]
          valid: boolean
        }[]
      }
      organization_role_rank: {
        Args: { p_role: Database["public"]["Enums"]["organization_role"] }
        Returns: number
      }
      organization_team: {
        Args: { p_organization: string }
        Returns: {
          display_name: string
          joined_at: string
          member_id: string
          role: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }[]
      }
      place_duplicates: {
        Args: never
        Returns: {
          a_id: string
          a_name: string
          a_slug: string
          a_status: string
          b_id: string
          b_name: string
          b_slug: string
          b_status: string
          distance_m: number
          same_phone: boolean
          similarity: number
        }[]
      }
      place_engagement: {
        Args: { p_place: string }
        Returns: {
          favorite: boolean
          liked: boolean
          likes: number
        }[]
      }
      place_is_public: { Args: { p_place: string }; Returns: boolean }
      place_point: {
        Args: { p_place: string }
        Returns: {
          lat: number
          lng: number
          location_precision: Database["public"]["Enums"]["location_precision"]
        }[]
      }
      pro_events: {
        Args: { p_business: string }
        Returns: {
          id: string
          rejection_reason: string
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
        }[]
      }
      pro_listings: {
        Args: { p_business: string }
        Returns: {
          availability_status: Database["public"]["Enums"]["availability_status"]
          category_name: string
          contact_reveals: number
          conversations: number
          expires_at: string
          favorites: number
          id: string
          rejection_reason: string
          schema: string
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          views: number
        }[]
      }
      pro_moderation_history: {
        Args: { p_business: string }
        Returns: {
          changed_at: string
          entity: string
          reason: string
          status_after: string
          status_before: string
          title: string
        }[]
      }
      pro_stats: {
        Args: { p_business: string }
        Returns: {
          conversations: number
          listing_contact_reveals: number
          listing_favorites: number
          listing_views: number
          listings_published: number
          page_favorites: number
          page_views: number
          rating_average: number
          requests_30d: number
          requests_total: number
          requests_unanswered: number
          reviews_published: number
        }[]
      }
      propose_neighborhood_boundary: {
        Args: {
          p_geojson: string
          p_neighborhood: string
          p_note?: string
          p_source?: string
        }
        Returns: string
      }
      purge_past_event_knowledge: { Args: never; Returns: number }
      purge_rate_limits: { Args: never; Returns: number }
      put_knowledge: {
        Args: {
          p_city: string
          p_content: string
          p_id: string
          p_keep: boolean
          p_source: string
          p_status: Database["public"]["Enums"]["verification_status"]
          p_title: string
          p_type: string
          p_url: string
          p_verified_at: string
        }
        Returns: undefined
      }
      quality_items: {
        Args: { p_kind: string }
        Returns: {
          detail: string
          entity_id: string
          entity_type: string
          since: string
          slug: string
          status: string
          title: string
          verification_status: string
        }[]
      }
      received_applications: {
        Args: never
        Returns: {
          applicant_id: string
          applicant_name: string
          created_at: string
          id: string
          listing_id: string
          listing_slug: string
          listing_title: string
          message: string
          status: Database["public"]["Enums"]["application_status"]
        }[]
      }
      received_business_reviews: {
        Args: { p_business: string }
        Returns: {
          author_name: string
          body: string
          created_at: string
          id: string
          rating: number
          response_at: string
          response_body: string
          status: Database["public"]["Enums"]["review_status"]
        }[]
      }
      record_business_view: {
        Args: { p_business: string; p_viewer_hash: string }
        Returns: boolean
      }
      record_listing_view: {
        Args: { p_listing: string; p_viewer_hash: string }
        Returns: boolean
      }
      record_search: {
        Args: {
          p_city: string
          p_query: string
          p_results: number
          p_type: string
        }
        Returns: undefined
      }
      record_search_alert: {
        Args: {
          p_link: string
          p_new: number
          p_search: string
          p_title: string
        }
        Returns: boolean
      }
      revalidation_threshold: { Args: never; Returns: string }
      reveal_candidate_contact: {
        Args: { p_user: string }
        Returns: {
          contact_email: string
          contact_phone: string
        }[]
      }
      reveal_listing_contact: {
        Args: { p_channel: string; p_listing: string }
        Returns: string
      }
      review_business_claim: {
        Args: { p_approve: boolean; p_claim: string; p_note?: string }
        Returns: undefined
      }
      review_neighborhood_boundary: {
        Args: { p_approve: boolean; p_boundary: string; p_note?: string }
        Returns: undefined
      }
      review_place_claim: {
        Args: { p_approve: boolean; p_claim: string; p_note?: string }
        Returns: undefined
      }
      revoke_organization_invitation: {
        Args: { p_invitation: string }
        Returns: undefined
      }
      safe_date: { Args: { p_value: string }; Returns: string }
      save_guide_article: {
        Args: {
          p_body: string
          p_change_note: string
          p_id: string
          p_section: string
          p_slug: string
          p_source: string
          p_status: Database["public"]["Enums"]["content_status"]
          p_summary: string
          p_title: string
          p_verification: Database["public"]["Enums"]["verification_status"]
        }
        Returns: string
      }
      save_neighborhood: {
        Args: {
          p_alt_names: string[]
          p_change_note: string
          p_description: string
          p_id: string
          p_is_active: boolean
          p_make_me_steward: boolean
          p_name: string
          p_source: string
          p_verification: Database["public"]["Enums"]["verification_status"]
        }
        Returns: undefined
      }
      search_anonymize: { Args: { p_query: string }; Returns: string }
      search_content: {
        Args: {
          p_available_only?: boolean
          p_categories?: string[]
          p_city: string
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_neighborhood?: string
          p_offset?: number
          p_price_max?: number
          p_price_min?: number
          p_query?: string
          p_radius_m?: number
          p_seller?: string
          p_sort?: string
          p_starts_from?: string
          p_starts_to?: string
          p_type: string
          p_verified_only?: boolean
        }
        Returns: {
          distance_m: number
          id: string
          total_count: number
        }[]
      }
      search_counts: {
        Args: {
          p_city: string
          p_lat?: number
          p_lng?: number
          p_neighborhood?: string
          p_query?: string
          p_radius_m?: number
          p_verified_only?: boolean
        }
        Returns: {
          total: number
          type: string
        }[]
      }
      search_events: {
        Args: {
          p_categories?: string[]
          p_city: string
          p_free?: boolean
          p_from?: string
          p_limit?: number
          p_neighborhood?: string
          p_offset?: number
          p_query?: string
          p_to?: string
        }
        Returns: {
          id: string
          total_count: number
        }[]
      }
      search_jobs: {
        Args: {
          p_categories: string[]
          p_city: string
          p_contract?: string
          p_domain?: string
          p_experience?: string
          p_limit?: number
          p_neighborhood?: string
          p_offset?: number
          p_organization?: string
          p_query?: string
          p_remote?: string
          p_since_days?: number
        }
        Returns: {
          id: string
          total_count: number
        }[]
      }
      search_knowledge: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          chunk_id: string
          content: string
          document_id: string
          entity_type: string
          rank: number
          source_title: string
          title: string
          url_path: string
          verified_at: string
        }[]
      }
      search_listings: {
        Args: {
          p_available_only?: boolean
          p_categories?: string[]
          p_city?: string
          p_eq?: Json
          p_limit?: number
          p_max?: Json
          p_min?: Json
          p_neighborhood?: string
          p_offset?: number
          p_price_max?: number
          p_price_min?: number
          p_query?: string
          p_sort?: string
          p_text?: Json
        }
        Returns: {
          id: string
          total_count: number
        }[]
      }
      search_matches: {
        Args: {
          p_available_only?: boolean
          p_categories?: string[]
          p_city: string
          p_lat?: number
          p_lng?: number
          p_neighborhood?: string
          p_price_max?: number
          p_price_min?: number
          p_query?: string
          p_radius_m?: number
          p_seller?: string
          p_starts_from?: string
          p_starts_to?: string
          p_type: string
          p_verified_only?: boolean
        }
        Returns: {
          boost: number
          distance_m: number
          id: string
          price: number
          rank: number
          recency: string
          starts_at: string
        }[]
      }
      search_normalize: { Args: { p_query: string }; Returns: string }
      search_professionals: {
        Args: {
          p_available_days?: number
          p_categories?: string[]
          p_city: string
          p_contact?: string
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_neighborhood?: string
          p_offset?: number
          p_query?: string
          p_radius_m?: number
          p_sort?: string
          p_verified_only?: boolean
        }
        Returns: {
          distance_m: number
          id: string
          total_count: number
        }[]
      }
      search_real_estate: {
        Args: {
          p_categories: string[]
          p_chambres_min?: number
          p_city: string
          p_confirmed_days?: number
          p_dispo?: boolean
          p_equipements?: string[]
          p_limit?: number
          p_meuble?: boolean
          p_neighborhood?: string
          p_offset?: number
          p_pieces_min?: number
          p_prix_max?: number
          p_prix_min?: number
          p_query?: string
          p_sort?: string
          p_stay?: string
          p_surface_min?: number
          p_type_bien?: string
        }
        Returns: {
          id: string
          total_count: number
        }[]
      }
      search_shops: {
        Args: {
          p_ambiance?: string[]
          p_budget_max?: number
          p_categories?: string[]
          p_city: string
          p_features?: string[]
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_neighborhood?: string
          p_offset?: number
          p_query?: string
          p_radius_m?: number
          p_sort?: string
          p_verified_only?: boolean
        }
        Returns: {
          distance_m: number
          id: string
          total_count: number
        }[]
      }
      search_tourism: {
        Args: {
          p_accessibility?: string[]
          p_audiences?: string[]
          p_budget_max?: number
          p_categories: string[]
          p_city: string
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_max_duration?: string
          p_neighborhood?: string
          p_offset?: number
          p_query?: string
          p_radius_m?: number
          p_sort?: string
          p_themes?: string[]
          p_verified_only?: boolean
        }
        Returns: {
          distance_m: number
          id: string
          total_count: number
        }[]
      }
      search_tsquery: { Args: { p_query: string }; Returns: unknown }
      send_event_reminders: { Args: never; Returns: number }
      set_ai_kill_switch: {
        Args: { p_disabled: boolean; p_reason: string }
        Returns: undefined
      }
      set_cabin_status: {
        Args: {
          p_delivery_code?: string
          p_detail: string
          p_operation: string
          p_provider_reference?: string
          p_source: string
          p_status: Database["public"]["Enums"]["cabin_status"]
        }
        Returns: Database["public"]["Enums"]["cabin_status"]
      }
      sponsored_shops: {
        Args: { p_categories?: string[]; p_city: string; p_limit?: number }
        Returns: {
          ends_at: string
          id: string
        }[]
      }
      start_event_conversation: {
        Args: { p_body: string; p_event: string }
        Returns: string
      }
      start_listing_conversation: {
        Args: { p_body: string; p_listing: string }
        Returns: string
      }
      start_place_conversation: {
        Args: { p_body: string; p_place: string }
        Returns: string
      }
      submit_appeal: {
        Args: { p_id: string; p_message: string; p_type: string }
        Returns: string
      }
      valid_opening_hours: { Args: { p_hours: Json }; Returns: boolean }
      verification_publicly_visible: {
        Args: { p_status: Database["public"]["Enums"]["verification_status"] }
        Returns: boolean
      }
      visit_duration_rank: { Args: { p_duration: string }; Returns: number }
    }
    Enums: {
      application_status:
        | "submitted"
        | "viewed"
        | "shortlisted"
        | "rejected"
        | "withdrawn"
      availability_status: "available" | "reserved" | "unavailable" | "unknown"
      billing_period: "month" | "year" | "one_time"
      cabin_mode: "demo" | "live"
      cabin_service:
        | "airtime"
        | "airtime_transfer"
        | "data"
        | "electricity"
        | "money_transfer"
      cabin_status:
        | "created"
        | "pending"
        | "processing"
        | "awaiting_confirmation"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "expired"
        | "refunded"
      campaign_placement: "home" | "search" | "category" | "map"
      campaign_status:
        | "draft"
        | "pending_payment"
        | "active"
        | "paused"
        | "ended"
        | "rejected"
      category_family: "decouvrir" | "trouver" | "entreprendre"
      city_launch_status: "planned" | "pilot" | "open"
      comment_status: "visible" | "hidden" | "deleted"
      consent_kind:
        | "terms"
        | "privacy"
        | "marketing_email"
        | "marketing_sms"
        | "geolocation"
        | "contact_sharing"
      contact_request_kind: "contact" | "devis"
      contact_request_status: "new" | "read" | "replied" | "archived"
      content_status:
        | "draft"
        | "pending"
        | "published"
        | "rejected"
        | "expired"
        | "archived"
      content_type: "listing" | "place" | "event" | "business"
      event_schedule_status: "scheduled" | "postponed" | "cancelled"
      location_precision: "exact" | "approximate" | "unknown"
      organization_kind:
        | "entreprise"
        | "commerce"
        | "artisan"
        | "agence"
        | "association"
        | "institution"
        | "operateur_touristique"
        | "autre"
      organization_role: "owner" | "admin" | "editor" | "viewer"
      payment_provider: "orange_money" | "mtn_momo" | "wave" | "card" | "manual"
      payment_status:
        | "initiated"
        | "pending"
        | "succeeded"
        | "failed"
        | "canceled"
        | "refunded"
      place_kind: "etablissement" | "lieu_touristique"
      price_unit:
        | "total"
        | "par_mois"
        | "par_jour"
        | "par_nuit"
        | "par_heure"
        | "a_partir_de"
      public_location_precision:
        | "exact"
        | "approximate"
        | "neighborhood"
        | "hidden"
      report_reason:
        | "arnaque"
        | "contenu_inapproprie"
        | "doublon"
        | "informations_erronees"
        | "autre"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      review_status: "pending" | "published" | "rejected" | "hidden"
      revision_action: "insert" | "update" | "delete"
      source_kind:
        | "terrain"
        | "officiel"
        | "partenaire"
        | "declaratif"
        | "publication"
        | "autre"
      subscription_status:
        | "pending"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
      user_role:
        | "user"
        | "professional"
        | "local_editor"
        | "moderator"
        | "admin"
        | "superadmin"
      verification_status:
        | "verified"
        | "pending_validation"
        | "placeholder"
        | "archived"
        | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      application_status: [
        "submitted",
        "viewed",
        "shortlisted",
        "rejected",
        "withdrawn",
      ],
      availability_status: ["available", "reserved", "unavailable", "unknown"],
      billing_period: ["month", "year", "one_time"],
      cabin_mode: ["demo", "live"],
      cabin_service: [
        "airtime",
        "airtime_transfer",
        "data",
        "electricity",
        "money_transfer",
      ],
      cabin_status: [
        "created",
        "pending",
        "processing",
        "awaiting_confirmation",
        "succeeded",
        "failed",
        "cancelled",
        "expired",
        "refunded",
      ],
      campaign_placement: ["home", "search", "category", "map"],
      campaign_status: [
        "draft",
        "pending_payment",
        "active",
        "paused",
        "ended",
        "rejected",
      ],
      category_family: ["decouvrir", "trouver", "entreprendre"],
      city_launch_status: ["planned", "pilot", "open"],
      comment_status: ["visible", "hidden", "deleted"],
      consent_kind: [
        "terms",
        "privacy",
        "marketing_email",
        "marketing_sms",
        "geolocation",
        "contact_sharing",
      ],
      contact_request_kind: ["contact", "devis"],
      contact_request_status: ["new", "read", "replied", "archived"],
      content_status: [
        "draft",
        "pending",
        "published",
        "rejected",
        "expired",
        "archived",
      ],
      content_type: ["listing", "place", "event", "business"],
      event_schedule_status: ["scheduled", "postponed", "cancelled"],
      location_precision: ["exact", "approximate", "unknown"],
      organization_kind: [
        "entreprise",
        "commerce",
        "artisan",
        "agence",
        "association",
        "institution",
        "operateur_touristique",
        "autre",
      ],
      organization_role: ["owner", "admin", "editor", "viewer"],
      payment_provider: ["orange_money", "mtn_momo", "wave", "card", "manual"],
      payment_status: [
        "initiated",
        "pending",
        "succeeded",
        "failed",
        "canceled",
        "refunded",
      ],
      place_kind: ["etablissement", "lieu_touristique"],
      price_unit: [
        "total",
        "par_mois",
        "par_jour",
        "par_nuit",
        "par_heure",
        "a_partir_de",
      ],
      public_location_precision: [
        "exact",
        "approximate",
        "neighborhood",
        "hidden",
      ],
      report_reason: [
        "arnaque",
        "contenu_inapproprie",
        "doublon",
        "informations_erronees",
        "autre",
      ],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      review_status: ["pending", "published", "rejected", "hidden"],
      revision_action: ["insert", "update", "delete"],
      source_kind: [
        "terrain",
        "officiel",
        "partenaire",
        "declaratif",
        "publication",
        "autre",
      ],
      subscription_status: [
        "pending",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
      user_role: [
        "user",
        "professional",
        "local_editor",
        "moderator",
        "admin",
        "superadmin",
      ],
      verification_status: [
        "verified",
        "pending_validation",
        "placeholder",
        "archived",
        "rejected",
      ],
    },
  },
} as const
