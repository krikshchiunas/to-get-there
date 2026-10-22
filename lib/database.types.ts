export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: { icon: string; id: string; is_main: boolean; name: string }
        Insert: { icon: string; id?: string; is_main?: boolean; name: string }
        Update: { icon?: string; id?: string; is_main?: boolean; name?: string }
        Relationships: []
      }
      direct_message_reads: {
        Row: { partner_id: string; read_at: string; user_id: string }
        Insert: { partner_id: string; read_at?: string; user_id: string }
        Update: { partner_id?: string; read_at?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: "direct_message_reads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          conversation_key: string | null
          created_at: string
          id: string
          media_url: string | null
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string
          conversation_key?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_key?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: { created_at: string; follower_id: string; following_id: string; id: string }
        Insert: { created_at?: string; follower_id: string; following_id: string; id?: string }
        Update: { created_at?: string; follower_id?: string; following_id?: string; id?: string }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          media_url: string | null
          post_id: string
          reply_to_id: string | null
        }
        Insert: {
          author_id: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          media_url?: string | null
          post_id: string
          reply_to_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          media_url?: string | null
          post_id?: string
          reply_to_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          payload: Json
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: { id: string; option_index: number; poll_id: string; user_id: string }
        Insert: { id?: string; option_index: number; poll_id: string; user_id: string }
        Update: { id?: string; option_index?: number; poll_id?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string
          id: string
          options: Json
          post_id: string
          question: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          options: Json
          post_id: string
          question: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          options?: Json
          post_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_moderators: {
        Row: { id: string; permissions: Json; post_id: string; user_id: string }
        Insert: { id?: string; permissions?: Json; post_id: string; user_id: string }
        Update: { id?: string; permissions?: Json; post_id?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: "post_moderators_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_moderators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_participants: {
        Row: { id: string; joined_at: string; post_id: string; user_id: string }
        Insert: { id?: string; joined_at?: string; post_id: string; user_id: string }
        Update: { id?: string; joined_at?: string; post_id?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: "post_participants_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          category_id: string
          chat_access: Database["public"]["Enums"]["chat_access"]
          created_at: string
          date_start: string
          description: string
          geo_address: string | null
          geo_city: string
          geo_lat: number | null
          geo_lng: number | null
          geo_mode: Database["public"]["Enums"]["geo_mode"]
          geo_radius_m: number | null
          id: string
          is_closed: boolean
          max_participants: number | null
          title: string
          university_id: string | null
        }
        Insert: {
          author_id: string
          category_id: string
          chat_access?: Database["public"]["Enums"]["chat_access"]
          created_at?: string
          date_start: string
          description?: string
          geo_address?: string | null
          geo_city: string
          geo_lat?: number | null
          geo_lng?: number | null
          geo_mode?: Database["public"]["Enums"]["geo_mode"]
          geo_radius_m?: number | null
          id?: string
          is_closed?: boolean
          max_participants?: number | null
          title: string
          university_id?: string | null
        }
        Update: {
          author_id?: string
          category_id?: string
          chat_access?: Database["public"]["Enums"]["chat_access"]
          created_at?: string
          date_start?: string
          description?: string
          geo_address?: string | null
          geo_city?: string
          geo_lat?: number | null
          geo_lng?: number | null
          geo_mode?: Database["public"]["Enums"]["geo_mode"]
          geo_radius_m?: number | null
          id?: string
          is_closed?: boolean
          max_participants?: number | null
          title?: string
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolved_at: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          resolved_at?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          resolved_at?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          campus_lat: number | null
          campus_lng: number | null
          city: string
          country: string
          domain: string
          id: string
          name: string
          short_name: string
        }
        Insert: {
          campus_lat?: number | null
          campus_lng?: number | null
          city: string
          country?: string
          domain: string
          id?: string
          name: string
          short_name: string
        }
        Update: {
          campus_lat?: number | null
          campus_lng?: number | null
          city?: string
          country?: string
          domain?: string
          id?: string
          name?: string
          short_name?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: { blocked_id: string; blocker_id: string; created_at: string }
        Insert: { blocked_id: string; blocker_id: string; created_at?: string }
        Update: { blocked_id?: string; blocker_id?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          notification_settings: Json
          user_id: string
        }
        Insert: {
          notification_settings?: Json
          user_id: string
        }
        Update: {
          notification_settings?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tags: {
        Row: {
          goals: string[]
          interests: string[]
          user_id: string
        }
        Insert: {
          goals?: string[]
          interests?: string[]
          user_id: string
        }
        Update: {
          goals?: string[]
          interests?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          faculty: string | null
          id: string
          is_verified: boolean
          nickname: string
          privacy_settings: Json
          university_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          faculty?: string | null
          id?: string
          is_verified?: boolean
          nickname: string
          privacy_settings?: Json
          university_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          faculty?: string | null
          id?: string
          is_verified?: boolean
          nickname?: string
          privacy_settings?: Json
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          created_at: string
          id: string
          last_error_code: string | null
          provider: string
          provider_session_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error_code?: string | null
          provider?: string
          provider_session_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error_code?: string | null
          provider?: string
          provider_session_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_posts: {
        Row: {
          author_id: string | null
          category_id: string | null
          chat_access: Database["public"]["Enums"]["chat_access"] | null
          created_at: string | null
          date_start: string | null
          description: string | null
          geo_address: string | null
          geo_city: string | null
          geo_lat: number | null
          geo_lng: number | null
          geo_mode: Database["public"]["Enums"]["geo_mode"] | null
          geo_radius_m: number | null
          id: string | null
          is_closed: boolean | null
          max_participants: number | null
          title: string | null
          university_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_conversations: {
        Row: {
          can_reply: boolean | null
          last_content: string | null
          last_created_at: string | null
          last_media_url: string | null
          last_message_id: string | null
          last_sender_id: string | null
          partner_id: string | null
          unread_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["last_sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_cards: {
        Row: {
          author_avatar_url: string | null
          author_faculty: string | null
          author_id: string | null
          author_is_verified: boolean | null
          author_nickname: string | null
          category_icon: string | null
          category_id: string | null
          category_is_main: boolean | null
          category_name: string | null
          chat_access: Database["public"]["Enums"]["chat_access"] | null
          created_at: string | null
          date_start: string | null
          description: string | null
          geo_address: string | null
          geo_city: string | null
          geo_lat: number | null
          geo_lng: number | null
          geo_mode: Database["public"]["Enums"]["geo_mode"] | null
          geo_radius_m: number | null
          id: string | null
          in_feed: boolean | null
          is_closed: boolean | null
          max_participants: number | null
          participant_count: number | null
          seats_left: number | null
          title: string | null
          university_city: string | null
          university_id: string | null
          university_name: string | null
          university_short_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_verification_result: {
        Args: { error_code?: string; member: string; new_status: string; session_id: string }
        Returns: undefined
      }
      cast_vote: { Args: { option_index: number; poll: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: undefined }
      auth_attempt: {
        Args: { email_key?: string | null; ip_key: string | null; operation: string }
        Returns: number
      }
      ensure_my_profile: { Args: never; Returns: string }
      export_my_data: { Args: never; Returns: Json }
      get_follow_counts: {
        Args: { user_ids: string[] }
        Returns: {
          followers: number
          following: number
          user_id: string
        }[]
      }
      is_poll_options: { Args: { options: Json }; Returns: boolean }
      is_tag_array: {
        Args: { arr: string[]; max_items: number; max_len: number }
        Returns: boolean
      }
      mark_conversation_read: { Args: { partner: string }; Returns: undefined }
      search_people: {
        Args: { max_results?: number; q: string }
        Returns: Database["public"]["Tables"]["users"]["Row"][]
        SetofOptions: { from: "*"; to: "users"; isOneToOne: false; isSetofReturn: true }
      }
      unread_direct_total: { Args: never; Returns: number }
    }
    Enums: {
      chat_access: "everyone" | "followers" | "friends"
      geo_mode: "radius" | "area" | "city"
      notification_type:
        | "new_participant"
        | "new_message"
        | "new_follower"
        | "new_post_from_following"
        | "event_reminder"
        | "verification_passed"
        | "verification_failed"
        | "post_updated"
      report_reason:
        | "spam"
        | "harassment"
        | "hate"
        | "sexual"
        | "violence"
        | "scam"
        | "impersonation"
        | "other"
      report_status: "open" | "actioned" | "dismissed"
      report_target: "user" | "post" | "message" | "direct_message"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  Name extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[Name] extends { Row: infer R }
  ? R
  : never

export type TablesInsert<Name extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][Name] extends { Insert: infer I } ? I : never

export type TablesUpdate<Name extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][Name] extends { Update: infer U } ? U : never

export type Enums<Name extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][Name]

export const Constants = {
  public: {
    Enums: {
      chat_access: ["everyone", "followers", "friends"],
      geo_mode: ["radius", "area", "city"],
      notification_type: [
        "new_participant",
        "new_message",
        "new_follower",
        "new_post_from_following",
        "event_reminder",
        "verification_passed",
        "verification_failed",
        "post_updated",
      ],
      report_reason: ["spam", "harassment", "hate", "sexual", "violence", "scam", "impersonation", "other"],
      report_status: ["open", "actioned", "dismissed"],
      report_target: ["user", "post", "message", "direct_message"],
    },
  },
} as const
