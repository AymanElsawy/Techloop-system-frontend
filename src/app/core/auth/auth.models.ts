export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  SALES_REP = 'SALES_REP',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.OWNER]: 'صاحب الشركة',
  [UserRole.ADMIN]: 'مدير النظام',
  [UserRole.SALES_REP]: 'مندوب',
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Sales rep's region; empty = no customers. Ignored for Owner/Admin. */
  governorates: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
}
