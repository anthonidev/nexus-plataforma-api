import { MembershipStatus } from '../entities/membership.entity';
import { UpgradeStatus } from '../entities/membership_upgrades.entity';

export interface UserMembershipInfo {
  hasMembership: boolean;
  membershipId?: number;
  status?: MembershipStatus;
  plan?: {
    id: number;
    name: string;
    price: number;
  };
  message?: string;
  endDate?: Date;
  pendingUpgrade?: {
    id: number;
    toPlan: {
      id: number;
      name: string;
    };
    upgradeCost: number;
    status: UpgradeStatus;
  };
}
