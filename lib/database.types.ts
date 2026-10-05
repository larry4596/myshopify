/**
 * Hand-written Supabase types for the NaijaBites schema (PRD §8).
 *
 * Kept in sync with supabase/schema.sql — if you change the SQL, change this
 * file too. Using these as the `Database` generic gives every query
 * compile-time checking of table/column names (important since the build is
 * the main validation gate before live testing).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      /**
       * Lesson 3 P1 — one-time mobile sign-in codes (supabase/mobile-auth.sql).
       * Near-empty by design: every row expires 60 seconds after it is written
       * and is consumed with a single atomic DELETE … RETURNING.
       */
      mobile_auth_codes: {
        Row: {
          code: string;
          user_id: string;
          sub: string;
          name: string | null;
          email: string | null;
          image: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          code: string;
          user_id: string;
          sub: string;
          name?: string | null;
          email?: string | null;
          image?: string | null;
          created_at?: string;
          expires_at: string;
        };
        Update: {
          code?: string;
          user_id?: string;
          sub?: string;
          name?: string | null;
          email?: string | null;
          image?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mobile_auth_codes_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * Lesson 3 P3 — server cart (supabase/cart-schema.sql). Keyed on
       * (user_id, product_id); the API speaks slugs (PRD-LESSON3 §6.2).
       */
      cart_items: {
        Row: {
          user_id: string;
          product_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          product_id: string;
          quantity: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          product_id?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          image: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          image?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          image?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          price_kobo: number;
          image_url: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description: string;
          price_kobo: number;
          image_url: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string;
          price_kobo?: number;
          image_url?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          status: "pending" | "paid" | "failed";
          total_kobo: number;
          currency: string;
          customer_name: string;
          customer_phone: string;
          address: string;
          notes: string | null;
          paid_at: string | null;
          created_at: string;
          /** Paystack reference that paid for this order (unique; FR4.5). */
          paystack_reference: string | null;
        };
        Insert: {
          id?: string;
          order_number: string;
          user_id: string;
          status: "pending" | "paid" | "failed";
          total_kobo: number;
          currency?: string;
          customer_name: string;
          customer_phone: string;
          address: string;
          notes?: string | null;
          paid_at?: string | null;
          created_at?: string;
          paystack_reference?: string | null;
        };
        Update: {
          id?: string;
          order_number?: string;
          user_id?: string;
          status?: "pending" | "paid" | "failed";
          total_kobo?: number;
          currency?: string;
          customer_name?: string;
          customer_phone?: string;
          address?: string;
          notes?: string | null;
          paid_at?: string | null;
          created_at?: string;
          paystack_reference?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          unit_price_kobo: number;
          quantity: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          unit_price_kobo: number;
          quantity: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          unit_price_kobo?: number;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_order: {
        Args: {
          p_user_id: string;
          p_items: Json;
          p_customer_name: string;
          p_customer_phone: string;
          p_address: string;
          p_notes?: string | null;
          p_status?: string;
          p_paystack_reference?: string | null;
        };
        Returns: string;
      };
      /** Lesson 3 P3 — fold a guest cart into the signed-in cart (§6). */
      merge_cart: {
        Args: {
          p_user_id: string;
          p_items: Json;
        };
        Returns: {
          user_id: string;
          product_id: string;
          quantity: number;
          updated_at: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
