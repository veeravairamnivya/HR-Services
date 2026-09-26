export type Role = "admin" | "manager" | "recruiter";

export interface UserBrief {
  id: number;
  full_name: string;
  email: string;
  role: Role;
}

export interface User extends UserBrief {
  phone: string | null;
  designation: string | null;
  daily_target: number;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface Attendance {
  id: number;
  user_id: number;
  user?: UserBrief | null;
  work_date: string;
  login_at: string;
  last_seen_at: string;
  logout_at: string | null;
  status: "present" | "late" | string;
  work_summary: string | null;
  hours_worked: number;
}

export interface Client {
  id: number;
  name: string;
  industry: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  location: string | null;
  website: string | null;
  status: "active" | "prospect" | "inactive";
  fee_percentage: number | null;
  payment_terms_days: number | null;
  notes: string | null;
  created_at: string;
  total_positions: number;
  open_positions: number;
  total_openings: number;
  total_candidates: number;
  offers: number;
  joined: number;
}

export interface Position {
  id: number;
  client_id: number;
  client: { id: number; name: string; industry: string | null };
  title: string;
  job_code: string | null;
  department: string | null;
  location: string | null;
  work_mode: "onsite" | "remote" | "hybrid";
  employment_type: string;
  min_experience: number | null;
  max_experience: number | null;
  min_budget: number | null;
  max_budget: number | null;
  openings: number;
  skills: string | null;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "on_hold" | "closed" | "filled";
  target_date: string | null;
  created_at: string;
  recruiters: UserBrief[];
  candidate_count: number;
  interview_count: number;
  offer_count: number;
  joined_count: number;
  stage_counts: Record<string, number>;
  days_open: number;
}

export interface Interview {
  id: number;
  candidate_id: number;
  round_number: number;
  round_name: string | null;
  scheduled_at: string | null;
  mode: "video" | "phone" | "in_person";
  interviewer: string | null;
  meeting_link: string | null;
  result: "pending" | "selected" | "rejected" | "on_hold" | "no_show";
  feedback: string | null;
  created_at: string;
}

export interface InterviewWithContext extends Interview {
  candidate_name: string;
  candidate_phone: string | null;
  candidate_stage: string;
  position_id: number;
  position_title: string;
  client_name: string;
  recruiter_name: string | null;
}

export interface Candidate {
  id: number;
  position_id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  current_company: string | null;
  current_designation: string | null;
  total_experience: number | null;
  relevant_experience: number | null;
  current_ctc: number | null;
  expected_ctc: number | null;
  offered_ctc: number | null;
  notice_period_days: number | null;
  current_location: string | null;
  preferred_location: string | null;
  skills: string | null;
  source: string | null;
  resume_url: string | null;
  stage: string;
  stage_updated_at: string;
  joining_date: string | null;
  remarks: string | null;
  recruiter_id: number | null;
  recruiter: UserBrief | null;
  created_at: string;
  updated_at: string;
  next_interview: Interview | null;
  interview_count: number;
}

export interface PositionBrief {
  id: number;
  title: string;
  status: string;
  client: { id: number; name: string };
}

export interface CandidateListItem extends Candidate {
  position: PositionBrief;
}

export interface StageHistory {
  id: number;
  candidate_id: number;
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  changed_by: UserBrief | null;
  changed_at: string;
}

export interface CandidateDetail extends CandidateListItem {
  interviews: Interview[];
  history: StageHistory[];
}

export interface Page<T> {
  total: number;
  items: T[];
}
