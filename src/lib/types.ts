export type Role = 'admin' | 'quality_engineer' | 'viewer';
export type SampleStatus = 'active' | 'near_expired' | 'ready_for_disposal' | 'disposed';
export type StorageLocation = 'Rack' | 'Transit Area' | 'Dump Trash';

export interface Paginated<T> { data: T[]; total: number; page: number; pageSize: number }

export interface AuthUser {
  id: string; email: string; display_name: string | null; role: Role; must_change_password: boolean;
}
export interface User extends AuthUser {
  is_active: number; last_login_at: string | null; created_at: string;
}

export interface Sample {
  id: string;
  specification: string | null;
  five_l_number: string;
  customer: string | null;
  paper_type: string | null;
  machine: string | null;
  shift: string | null;
  inspector: string | null;
  production_date: string;
  expiration_date: string | null;
  remark: string | null;
  storage_location: StorageLocation;
  rack_detail: string | null;
  status: SampleStatus;
  days_left: number | null;
  disposed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SampleInput {
  specification: string; five_l_number: string; customer: string; paper_type: string; machine: string;
  shift: string; inspector: string; production_date: string; remark: string;
  storage_location: StorageLocation; rack_detail: string;
}

export interface Movement {
  id: number; sample_id: string; five_l_number: string | null; kind: 'create' | 'move' | 'dispose';
  old_location: string | null; new_location: string; old_rack_detail: string | null; new_rack_detail: string | null;
  moved_by_name: string | null; moved_at: string; note: string | null;
}

export interface Disposal {
  id: number; sample_id: string; five_l_number: string | null; specification: string | null; customer: string | null;
  machine: string | null; production_date: string | null; expiration_date: string | null; previous_location: string | null;
  disposed_by_name: string | null; disposed_at: string; note: string | null;
}

export interface AuditEntry {
  id: number; table_name: string; record_id: string | null; action: string;
  old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null;
  user_email: string | null; changed_at: string;
}

export interface AppNotification {
  id: string; sample_id: string; threshold: 0 | 7 | 14 | 30; message: string; is_read: number; created_at: string;
  five_l_number: string; customer: string | null; expiration_date: string | null; storage_location: string; status: SampleStatus;
}

export interface DashboardData {
  totals: { all: number; active: number; near_expired: number; ready_for_disposal: number; disposed: number };
  locations: Partial<Record<StorageLocation, number>>;
  bands: { due_now: number; within_7: number; within_14: number; within_30: number };
  upcoming: { id: string; five_l_number: string; customer: string | null; expiration_date: string; days_left: number; storage_location: string }[];
  recentMovements: Pick<Movement, 'id' | 'five_l_number' | 'kind' | 'old_location' | 'new_location' | 'moved_by_name' | 'moved_at'>[];
  recentDisposals: Pick<Disposal, 'id' | 'five_l_number' | 'customer' | 'disposed_by_name' | 'disposed_at'>[];
  unreadNotifications: number;
}

export const LOCATION_OPTIONS: StorageLocation[] = ['Rack', 'Transit Area', 'Dump Trash'];
export const SHIFT_OPTIONS = ['1', '2', '3'];
export const STATUS_LABEL: Record<SampleStatus, string> = {
  active: 'Active', near_expired: 'Near Expired', ready_for_disposal: 'Ready for Disposal', disposed: 'Disposed',
};
export const ROLE_LABEL: Record<Role, string> = { admin: 'Administrator', quality_engineer: 'Quality Engineer', viewer: 'Viewer' };
