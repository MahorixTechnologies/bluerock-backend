export const UserRole = {
  RENTER: 'RENTER',
  LANDLORD: 'LANDLORD',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};
