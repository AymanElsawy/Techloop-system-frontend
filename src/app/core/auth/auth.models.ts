export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  SALES_REP = 'SALES_REP',
  WAREHOUSE_REP = 'WAREHOUSE_REP',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.OWNER]: 'صاحب الشركة',
  [UserRole.ADMIN]: 'مدير النظام',
  [UserRole.SALES_REP]: 'مندوب',
  [UserRole.WAREHOUSE_REP]: 'مندوب مخزن',
};

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  /** Sales rep's region; empty = no customers. Ignored for Owner/Admin. */
  governorates: string[];
  /** Still on the default password: must set a new one before using the app. */
  mustChangePassword: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
}
