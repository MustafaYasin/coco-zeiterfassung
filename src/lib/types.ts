export type Member = {
  id: string;
  user_id: string | null;
  username: string;
  display_name: string;
  is_admin: boolean;
  active: boolean;
  created_at: string;
};

export type TimeEntry = {
  id: string;
  member_id: string;
  started_at: string;
  ended_at: string | null;
  break_minutes: number;
  note: string;
  source: "app" | "import";
};
