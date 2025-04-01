import { MembershipStatus } from '../entities/membership.entity';

export interface UserMembershipInfo {
  hasMembership: boolean;
  status?: MembershipStatus;
  plan?: {
    id: number;
    name: string;
    price: number;
    // Otros detalles relevantes del plan
  };
  message?: string;
  nextReconsumptionDate?: Date;
  endDate?: Date;
}
