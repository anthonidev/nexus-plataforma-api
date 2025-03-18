export interface FlatUser {
  id: string;
  email: string;
  referralCode: string;
  position: string;
  isActive: boolean;
  firstName?: string;
  lastName?: string;
  leftChildId?: string;
  rightChildId?: string;
  parentId?: string;
}
