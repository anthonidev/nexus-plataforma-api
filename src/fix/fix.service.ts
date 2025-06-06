import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Membership } from 'src/memberships/entities/membership.entity';
import { Repository } from 'typeorm';

@Injectable()
export class FixService {
  private readonly logger = new Logger(FixService.name);
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
  ) {}
  async updateAllMembershipsMinimumReconsumption(newAmount: number) {
    try {
      const memberships = await this.membershipRepository.find({
        relations: ['user', 'user.personalInfo', 'plan'],
      });

      const updatedMemberships = [];

      for (const membership of memberships) {
        const oldAmount = membership.minimumReconsumptionAmount;

        membership.minimumReconsumptionAmount = newAmount;
        await this.membershipRepository.save(membership);

        updatedMemberships.push({
          membershipId: membership.id,
          userId: membership.user.id,
          userEmail: membership.user.email,
          userName: `${membership.user.personalInfo?.firstName} ${membership.user.personalInfo?.lastName}`,
          planName: membership.plan.name,
          oldAmount,
          newAmount,
        });
      }

      return {
        success: true,
        message: `Se actualizaron ${memberships.length} membresías con el nuevo monto mínimo de reconsumo`,
        totalUpdated: memberships.length,
        newMinimumAmount: newAmount,
        updatedMemberships,
      };
    } catch (error) {
      this.logger.error(`Error al actualizar membresías: ${error.message}`);
      throw error;
    }
  }
}
