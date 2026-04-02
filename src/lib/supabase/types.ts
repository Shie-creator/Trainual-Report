export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      employees: {
        Row: {
          active: boolean;
          created_at: string;
          department: string | null;
          employee_email: string | null;
          employee_external_id: string | null;
          employee_name: string;
          id: string;
          job_title: string | null;
          last_active: string | null;
          manager_id: string | null;
          work_location: "Onshore" | "Offshore" | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          department?: string | null;
          employee_email?: string | null;
          employee_external_id?: string | null;
          employee_name: string;
          id?: string;
          job_title?: string | null;
          last_active?: string | null;
          manager_id?: string | null;
          work_location?: "Onshore" | "Offshore" | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "employees_manager_id_fkey";
            columns: ["manager_id"];
            referencedRelation: "managers";
            referencedColumns: ["id"];
          },
        ];
      };
      imports: {
        Row: {
          id: string;
          import_type: "completion" | "manager_mapping";
          imported_at: string;
          notes: string | null;
          row_count: number;
          source_name: string;
          status: "pending" | "success" | "warning" | "failed";
          storage_path: string | null;
        };
        Insert: {
          id?: string;
          import_type: "completion" | "manager_mapping";
          imported_at?: string;
          notes?: string | null;
          row_count?: number;
          source_name: string;
          status: "pending" | "success" | "warning" | "failed";
          storage_path?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["imports"]["Insert"]>;
        Relationships: [];
      };
      managers: {
        Row: {
          created_at: string;
          department: string | null;
          id: string;
          manager_email: string | null;
          manager_name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          department?: string | null;
          id?: string;
          manager_email?: string | null;
          manager_name: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["managers"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          role: "member" | "admin";
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          role?: "member" | "admin";
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      trainual_completions: {
        Row: {
          completed_modules: number | null;
          completion_percentage: number;
          created_at: string;
          employee_id: string;
          id: string;
          remaining_modules: number | null;
          snapshot_date: string | null;
          total_modules: number | null;
        };
        Insert: {
          completed_modules?: number | null;
          completion_percentage: number;
          created_at?: string;
          employee_id: string;
          id?: string;
          remaining_modules?: number | null;
          snapshot_date?: string | null;
          total_modules?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["trainual_completions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "trainual_completions_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
  };
};
