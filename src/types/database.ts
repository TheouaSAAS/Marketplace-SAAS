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
          id: string
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
          id?: string
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
          id?: string
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
      categories: {
        Row: {
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
          business_id: string | null
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
          business_id?: string | null
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
          business_id?: string | null
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
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          document_id: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          document_id?: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
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
          claimant_id: string
          claimant_role: string
          created_at: string
          decision_note: string | null
          evidence: string
          id: string
          message: string
          phone: string
          place_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          claimant_id: string
          claimant_role: string
          created_at?: string
          decision_note?: string | null
          evidence: string
          id?: string
          message: string
          phone: string
          place_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          claimant_id?: string
          claimant_role?: string
          created_at?: string
          decision_note?: string | null
          evidence?: string
          id?: string
          message?: string
          phone?: string
          place_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
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
          updated_at: string
          user_id: string
        }
        Insert: {
          account_intent?: string
          locale?: string
          notification_channels?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          account_intent?: string
          locale?: string
          notification_channels?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
      attr_bool: {
        Args: { p_attributes: Json; p_key: string }
        Returns: boolean
      }
      attr_int: { Args: { p_attributes: Json; p_key: string }; Returns: number }
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
      business_public_point: {
        Args: { p_business: string }
        Returns: {
          lat: number
          lng: number
          location_precision: Database["public"]["Enums"]["public_location_precision"]
        }[]
      }
      can_manage_content: {
        Args: { p_organization: string; p_owner: string }
        Returns: boolean
      }
      category_content_counts: {
        Args: { p_city: string; p_slugs: string[] }
        Returns: {
          slug: string
          total: number
        }[]
      }
      chunk_text: {
        Args: { p_max?: number; p_text: string }
        Returns: string[]
      }
      clear_neighborhood_boundary: {
        Args: { p_neighborhood: string; p_note: string }
        Returns: undefined
      }
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
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      demo_content_public: { Args: never; Returns: boolean }
      expire_listings: { Args: never; Returns: number }
      export_my_data: { Args: never; Returns: Json }
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
      immutable_unaccent: { Args: { input: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_conversation_participant: {
        Args: { p_conversation: string }
        Returns: boolean
      }
      is_curator: { Args: never; Returns: boolean }
      is_org_member: {
        Args: {
          p_min_role?: Database["public"]["Enums"]["organization_role"]
          p_organization: string
        }
        Returns: boolean
      }
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
      listing_engagement: {
        Args: { p_listing: string }
        Returns: {
          comments: number
          liked: boolean
          likes: number
          views: number
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
      my_conversations: {
        Args: never
        Returns: {
          conversation_id: string
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
      organization_role_rank: {
        Args: { p_role: Database["public"]["Enums"]["organization_role"] }
        Returns: number
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
      propose_neighborhood_boundary: {
        Args: {
          p_geojson: string
          p_neighborhood: string
          p_note?: string
          p_source?: string
        }
        Returns: string
      }
      purge_rate_limits: { Args: never; Returns: number }
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
      reveal_listing_contact: {
        Args: { p_channel: string; p_listing: string }
        Returns: string
      }
      review_neighborhood_boundary: {
        Args: { p_approve: boolean; p_boundary: string; p_note?: string }
        Returns: undefined
      }
      review_place_claim: {
        Args: { p_approve: boolean; p_claim: string; p_note?: string }
        Returns: undefined
      }
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
      sponsored_shops: {
        Args: { p_categories?: string[]; p_city: string; p_limit?: number }
        Returns: {
          ends_at: string
          id: string
        }[]
      }
      start_listing_conversation: {
        Args: { p_body: string; p_listing: string }
        Returns: string
      }
      start_place_conversation: {
        Args: { p_body: string; p_place: string }
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
