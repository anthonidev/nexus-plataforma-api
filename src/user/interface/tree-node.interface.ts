export interface TreeNode {
  id: string;
  email: string;
  referralCode: string;
  position: string;
  isActive: boolean;
  fullName?: string;
  depth: number;
  children?: {
    left?: TreeNode;
    right?: TreeNode;
  };
}
