import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveMembershipSubscriptionDto {
  @IsBoolean()
  @IsNotEmpty({ message: 'La aprobación es requerida' })
  approved: boolean;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string; // Solo requerido si approved = false
}
