import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Role } from 'src/user/entities/roles.entity';
import { User } from 'src/user/entities/user.entity';
import { ContactInfo } from 'src/user/entities/contact-info.entity';
import { PersonalInfo } from 'src/user/entities/personal-info.entity';
import { Ubigeo } from 'src/user/entities/ubigeo.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class GlobalAccountsSeedService {
  private readonly logger = new Logger(GlobalAccountsSeedService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Ubigeo)
    private readonly ubigeoRepository: Repository<Ubigeo>,
    private readonly dataSource: DataSource,
  ) {}

  async seedGlobalAccounts(): Promise<any> {
    this.logger.log('Iniciando seed de cuentas globales fantasma');
    const startTime = Date.now();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener la cuenta maestra (el padre de todo)
      const masterUser = await this.userRepository.findOne({
        where: { email: 'cesar.huertas@inmobiliariahuertas.com' },
      });

      if (!masterUser) {
        throw new Error('No se encontró la cuenta maestra. Ejecuta primero el seed de usuarios.');
      }

      // Obtener rol cliente
      const clientRole = await this.roleRepository.findOne({
        where: { code: 'CLI' },
      });

      if (!clientRole) {
        throw new Error('No se encontró el rol CLI. Ejecuta primero el seed de roles.');
      }

      // Obtener un ubigeo para las cuentas
      const defaultUbigeo = await this.ubigeoRepository.findOne({
        where: { code: '150101' },
      });

      if (!defaultUbigeo) {
        throw new Error('No hay ubicaciones (ubigeos) disponibles en el sistema.');
      }

      const accounts = [];
      const defaultPass = 'NexusGlobal123$';

      // Crear 10 cuentas fantasmas
      for (let i = 1; i <= 10; i++) {
        const accountNumber = i.toString().padStart(2, '0'); // 01, 02, etc.
        const email = `nexusglobal${accountNumber}@nexusplatform.com`;
        const firstName = `Nexus`;
        const lastName = `Global ${accountNumber}`;

        // Verificar si la cuenta ya existe
        const existingUser = await this.userRepository.findOne({
          where: { email },
        });

        if (existingUser) {
          this.logger.warn(`La cuenta ${email} ya existe, omitiendo.`);
          continue;
        }

        // Crear el usuario
        const user = new User();
        user.email = email;
        user.password = await this.hashPassword(defaultPass);
        user.referralCode = this.generateReferralCode();
        user.role = clientRole;
        user.position = 'LEFT';
        user.parent = masterUser;
        user.referrerCode = masterUser.referralCode;

        const savedUser = await queryRunner.manager.save(user);

        // Actualizar la referencia leftChild en el padre si es la primera cuenta
        if (i === 1) {
          masterUser.leftChild = savedUser;
          await queryRunner.manager.save(masterUser);
        } else {
          // Para las demás cuentas, actualizar la referencia leftChild de la cuenta anterior
          const previousUser = accounts[accounts.length - 1];
          previousUser.leftChild = savedUser;
          await queryRunner.manager.save(previousUser);
        }

        // Crear información personal
        const personalInfo = new PersonalInfo();
        personalInfo.firstName = firstName;
        personalInfo.lastName = lastName;
        personalInfo.gender = 'MASCULINO';
        personalInfo.birthDate = new Date('1990-01-01');
        personalInfo.user = savedUser;

        await queryRunner.manager.save(personalInfo);

        // Crear información de contacto
        const contactInfo = new ContactInfo();
        contactInfo.phone = `9${this.generateRandomDigits(8)}`;
        contactInfo.address = `Calle Nexus ${accountNumber}`;
        contactInfo.ubigeo = defaultUbigeo;
        contactInfo.user = savedUser;

        await queryRunner.manager.save(contactInfo);

        accounts.push(savedUser);
        this.logger.log(`Cuenta global ${email} creada exitosamente`);
      }

      await queryRunner.commitTransaction();

      const duration = Date.now() - startTime;
      this.logger.log(`Seed de cuentas globales completado en ${duration}ms`);

      return {
        success: true,
        duration: `${duration}ms`,
        accountCount: accounts.length,
        accounts: accounts.map(user => ({
          id: user.id,
          email: user.email,
        })),
      };
    } catch (error) {
      this.logger.error(`Error en seed de cuentas globales: ${error.message}`);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  private generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  private generateRandomDigits(length: number): string {
    return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
  }
}