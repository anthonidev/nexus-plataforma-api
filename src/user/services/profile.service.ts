import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateBankInfoDto } from '../dto/update-back-info.dto';
import { UpdateBillingInfoDto } from '../dto/update-billing-info.dto';
import { UpdateContactInfoDto } from '../dto/update-contact-info.dto';
import { UpdatePersonalInfoDto } from '../dto/update-personal-info.dto';
import { BankInfo } from '../entities/bank-info.entity';
import { BillingInfo } from '../entities/billing-info.entity';
import { ContactInfo } from '../entities/contact-info.entity';
import { Ubigeo } from '../entities/ubigeo.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ContactInfo)
    private readonly contactInfoRepository: Repository<ContactInfo>,
    @InjectRepository(BillingInfo)
    private readonly billingInfoRepository: Repository<BillingInfo>,
    @InjectRepository(BankInfo)
    private readonly bankInfoRepository: Repository<BankInfo>,
    @InjectRepository(Ubigeo)
    private readonly ubigeoRepository: Repository<Ubigeo>,
  ) {}

  async getUserProfile(userId: string) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: [
          'personalInfo',
          'contactInfo',
          'contactInfo.ubigeo',
          'billingInfo',
          'billingInfo.ubigeo',
          'bankInfo',
          'role',
        ],
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      delete user.password;

      return {
        id: user.id,
        email: user.email,
        referralCode: user.referralCode,
        isActive: user.isActive,
        role: {
          id: user.role.id,
          code: user.role.code,
          name: user.role.name,
        },
        personalInfo: user.personalInfo,
        contactInfo: user.contactInfo,
        billingInfo: user.billingInfo,
        bankInfo: user.bankInfo,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo perfil de usuario: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al obtener perfil de usuario',
      );
    }
  }

  async updateContactInfo(
    userId: string,
    updateContactInfoDto: UpdateContactInfoDto,
  ) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['contactInfo'],
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      let contactInfo = user.contactInfo;

      // Si hay un ubigeo, verificar que exista
      if (updateContactInfoDto.ubigeoId) {
        const ubigeo = await this.ubigeoRepository.findOne({
          where: { id: updateContactInfoDto.ubigeoId },
        });

        if (!ubigeo) {
          throw new NotFoundException(
            `Ubigeo con ID ${updateContactInfoDto.ubigeoId} no encontrado`,
          );
        }
      }

      if (!contactInfo) {
        // Crear nuevo contactInfo si no existe
        contactInfo = this.contactInfoRepository.create({
          ...updateContactInfoDto,
          ubigeo: updateContactInfoDto.ubigeoId
            ? { id: updateContactInfoDto.ubigeoId }
            : null,
          user,
        });
      } else {
        // Actualizar contactInfo existente
        this.contactInfoRepository.merge(contactInfo, {
          ...updateContactInfoDto,
          ubigeo: updateContactInfoDto.ubigeoId
            ? { id: updateContactInfoDto.ubigeoId }
            : contactInfo.ubigeo,
        });
      }

      await this.contactInfoRepository.save(contactInfo);

      return {
        success: true,
        message: 'Información de contacto actualizada correctamente',
        contactInfo,
      };
    } catch (error) {
      this.logger.error(`Error actualizando contactInfo: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al actualizar información de contacto',
      );
    }
  }

  async updateBillingInfo(
    userId: string,
    updateBillingInfoDto: UpdateBillingInfoDto,
  ) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['billingInfo'],
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      let billingInfo = user.billingInfo;

      // Si hay un ubigeo, verificar que exista
      if (updateBillingInfoDto.ubigeoId) {
        const ubigeo = await this.ubigeoRepository.findOne({
          where: { id: updateBillingInfoDto.ubigeoId },
        });

        if (!ubigeo) {
          throw new NotFoundException(
            `Ubigeo con ID ${updateBillingInfoDto.ubigeoId} no encontrado`,
          );
        }
      }

      if (!billingInfo) {
        // Crear nueva billingInfo si no existe
        billingInfo = this.billingInfoRepository.create({
          ...updateBillingInfoDto,
          ubigeo: updateBillingInfoDto.ubigeoId
            ? { id: updateBillingInfoDto.ubigeoId }
            : null,
          user,
        });
      } else {
        // Actualizar billingInfo existente
        this.billingInfoRepository.merge(billingInfo, {
          ...updateBillingInfoDto,
          ubigeo: updateBillingInfoDto.ubigeoId
            ? { id: updateBillingInfoDto.ubigeoId }
            : billingInfo.ubigeo,
        });
      }

      await this.billingInfoRepository.save(billingInfo);

      return {
        success: true,
        message: 'Información de facturación actualizada correctamente',
        billingInfo,
      };
    } catch (error) {
      this.logger.error(`Error actualizando billingInfo: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al actualizar información de facturación',
      );
    }
  }

  async updateBankInfo(userId: string, updateBankInfoDto: UpdateBankInfoDto) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['bankInfo'],
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      let bankInfo = user.bankInfo;

      if (!bankInfo) {
        // Crear nueva bankInfo si no existe
        bankInfo = this.bankInfoRepository.create({
          ...updateBankInfoDto,
          user,
        });
      } else {
        // Actualizar bankInfo existente
        this.bankInfoRepository.merge(bankInfo, updateBankInfoDto);
      }

      await this.bankInfoRepository.save(bankInfo);

      return {
        success: true,
        message: 'Información bancaria actualizada correctamente',
        bankInfo,
      };
    } catch (error) {
      this.logger.error(`Error actualizando bankInfo: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al actualizar información bancaria',
      );
    }
  }
  async updatePersonalInfo(
    userId: string,
    updatePersonalInfoDto: UpdatePersonalInfoDto,
  ) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['personalInfo'],
        select: ['id', 'isActive'],
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      let personalInfo = user.personalInfo;

      if (!personalInfo) {
        throw new NotFoundException(
          `Información personal no encontrada para el usuario ${userId}`,
        );
      }

      // Actualizar solo el campo documentNumber
      if (updatePersonalInfoDto.documentNumber !== undefined) {
        personalInfo.documentNumber = updatePersonalInfoDto.documentNumber;
      }

      await this.userRepository.manager.save(personalInfo);

      return {
        success: true,
        message: 'Información personal actualizada correctamente',
        personalInfo: {
          firstName: personalInfo.firstName,
          lastName: personalInfo.lastName,
          documentNumber: personalInfo.documentNumber,
          gender: personalInfo.gender,
          birthDate: personalInfo.birthDate,
        },
      };
    } catch (error) {
      this.logger.error(`Error actualizando personalInfo: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al actualizar información personal',
      );
    }
  }
}
