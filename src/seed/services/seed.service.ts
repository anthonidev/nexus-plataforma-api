import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import * as bcrypt from 'bcryptjs';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import { PaymentConfig } from 'src/payments/entities/payment-config.entity';
import { ContactInfo } from 'src/user/entities/contact-info.entity';
import { PersonalInfo } from 'src/user/entities/personal-info.entity';
import { Role } from 'src/user/entities/roles.entity';
import { Ubigeo } from 'src/user/entities/ubigeo.entity';
import { User } from 'src/user/entities/user.entity';
import { View } from 'src/user/entities/view.entity';
import { DataSource, In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { rolData, vistaData } from '../data/auth.data';
import { membershipPlansData } from '../data/membership-plans.data';
import { paymentConfigsData } from '../data/payment-configs.data';
import {
  departamentosData,
  distritosData,
  provinciasData,
} from '../data/ubigeo.data';

import { Rank } from 'src/ranks/entities/ranks.entity';
import { WithdrawalConfig } from 'src/withdrawals/entities/withdrawal-config.entity';
import { CutConfiguration } from 'src/cuts/entities/cut_configurations.entity';
import { cutConfigurationsData } from '../data/cuts.data';
import { withdrawalConfigsData } from '../data/withdrawal-config.data';
import { rankData } from '../data/rank.data';
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);
  private readonly SALT_ROUNDS = 10;
  constructor(
    @InjectRepository(View)
    private readonly viewRepository: Repository<View>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(MembershipPlan)
    private readonly membershipPlanRepository: Repository<MembershipPlan>,
    @InjectRepository(PaymentConfig)
    private readonly paymentConfigRepository: Repository<PaymentConfig>,

    @InjectRepository(CutConfiguration)
    private readonly cutConfigurationRepository: Repository<CutConfiguration>,

    @InjectRepository(WithdrawalConfig)
    private readonly withdrawalConfigRepository: Repository<WithdrawalConfig>,
    @InjectRepository(Ubigeo)
    private readonly ubigeoRepository: Repository<Ubigeo>,
    @InjectRepository(Rank)
    private readonly rankRepository: Repository<Rank>,
    private readonly dataSource: DataSource,
  ) {}
  private async createView(viewData: any, parentView?: View): Promise<View> {
    const { code, name, url, order, icon } = viewData;
    try {
      const existingView = await this.viewRepository.findOne({
        where: { code },
      });
      if (existingView) {
        this.logger.debug(`Vista existente encontrada: ${code}`);
        return existingView;
      }
      const view = this.viewRepository.create({
        name,
        url,
        order,
        icon,
        code,
        isActive: true,
        parent: parentView,
      });
      const savedView = await this.viewRepository.save(view);
      this.logger.log(`Vista creada exitosamente: ${code}`);
      return savedView;
    } catch (error) {
      this.logger.error(`Error al crear vista ${code}: ${error.message}`);
      throw error;
    }
  }
  async seedViews() {
    this.logger.log('Iniciando seed de vistas...');
    try {
      const parentViews = vistaData.filter((view) => !view.parent);
      this.logger.debug(`Encontradas ${parentViews.length} vistas padre`);
      const createdParentViews = await Promise.all(
        parentViews.map((viewData) => this.createView(viewData)),
      );
      const parentViewMap = createdParentViews.reduce((map, view) => {
        map[view.code] = view;
        return map;
      }, {});
      let childrenCount = 0;
      for (const parentView of parentViews) {
        if (parentView.children?.length) {
          this.logger.debug(
            `Procesando ${parentView.children.length} hijos para ${parentView.code}`,
          );
          await Promise.all(
            parentView.children.map(async (childData) => {
              await this.createView(childData, parentViewMap[childData.parent]);
              childrenCount++;
            }),
          );
        }
      }
      this.logger.log(
        `Seed de vistas completado. Creadas ${createdParentViews.length} vistas padre y ${childrenCount} vistas hijas`,
      );
    } catch (error) {
      this.logger.error(`Error en seedViews: ${error.message}`);
      throw error;
    }
  }
  async seedRoles() {
    this.logger.log('Iniciando seed de roles...');
    try {
      const results = await Promise.all(
        rolData.map(async (roleData) => {
          try {
            const existingRole = await this.roleRepository.findOne({
              where: { code: roleData.code },
            });
            if (existingRole) {
              this.logger.debug(`Rol existente encontrado: ${roleData.code}`);
              return { status: 'existing', code: roleData.code };
            }
            const views = await this.viewRepository.findBy({
              code: In(roleData.views),
            });
            this.logger.debug(
              `Encontradas ${views.length}/${roleData.views.length} vistas para rol ${roleData.code}`,
            );
            const role = this.roleRepository.create({
              name: roleData.name,
              code: roleData.code,
              views: views,
            });
            await this.roleRepository.save(role);
            this.logger.log(`Rol creado exitosamente: ${roleData.code}`);
            return { status: 'created', code: roleData.code };
          } catch (error) {
            this.logger.error(
              `Error al crear rol ${roleData.code}: ${error.message}`,
            );
            return {
              status: 'error',
              code: roleData.code,
              error: error.message,
            };
          }
        }),
      );
      const created = results.filter((r) => r.status === 'created').length;
      const existing = results.filter((r) => r.status === 'existing').length;
      const errors = results.filter((r) => r.status === 'error').length;
      this.logger.log(
        `Seed de roles completado. Creados: ${created}, Existentes: ${existing}, Errores: ${errors}`,
      );
    } catch (error) {
      this.logger.error(`Error en seedRoles: ${error.message}`);
      throw error;
    }
  }
  async seedCutConfigurations() {
    this.logger.log('Iniciando seed de configuraciones de corte...');
    try {
      const results = await Promise.all(
        cutConfigurationsData.map(async (configData) => {
          try {
            const existingConfig =
              await this.cutConfigurationRepository.findOne({
                where: { code: configData.code },
              });

            if (existingConfig) {
              this.logger.debug(
                `Configuración de corte existente encontrada: ${configData.code}`,
              );

              Object.assign(existingConfig, configData);
              await this.cutConfigurationRepository.save(existingConfig);

              return { status: 'updated', code: configData.code };
            }

            const config = this.cutConfigurationRepository.create(configData);
            await this.cutConfigurationRepository.save(config);
            this.logger.log(
              `Configuración de corte creada exitosamente: ${configData.code}`,
            );
            return { status: 'created', code: configData.code };
          } catch (error) {
            this.logger.error(
              `Error al crear configuración de corte ${configData.code}: ${error.message}`,
            );
            return {
              status: 'error',
              code: configData.code,
              error: error.message,
            };
          }
        }),
      );

      const created = results.filter((r) => r.status === 'created').length;
      const updated = results.filter((r) => r.status === 'updated').length;
      const errors = results.filter((r) => r.status === 'error').length;
      this.logger.log(
        `Seed de configuraciones de corte completado. Creados: ${created}, Actualizados: ${updated}, Errores: ${errors}`,
      );

      return {
        created,
        updated,
        errors,
        details: results,
      };
    } catch (error) {
      this.logger.error(
        `Error general en seedCutConfigurations: ${error.message}`,
      );
      throw error;
    }
  }
  async seedUbigeo() {
    this.logger.log('Iniciando seed de ubigeo...');
    try {
      // PASO 1: Insertar todos los departamentos y esperar a que terminen
      this.logger.log('Iniciando inserción de departamentos...');
      const departamentos = departamentosData;

      // Utilizamos Promise.all para esperar que todos los departamentos se inserten
      await Promise.all(
        departamentos.map(async (departamento) => {
          const existingDepartamento = await this.ubigeoRepository.findOne({
            where: { code: departamento.id },
          });

          if (existingDepartamento) {
            this.logger.debug(
              `Departamento existente encontrado: ${departamento.id}`,
            );
            return;
          }

          const newDepartamento = this.ubigeoRepository.create({
            name: departamento.name,
            code: departamento.id,
            parentId: null,
          });

          await this.ubigeoRepository.save(newDepartamento);
          this.logger.log(
            `Departamento creado exitosamente: ${departamento.id}`,
          );
        }),
      );
      this.logger.log('Todos los departamentos han sido procesados.');

      // PASO 2: Insertar todas las provincias y esperar a que terminen
      this.logger.log('Iniciando inserción de provincias...');
      const provincias = provinciasData;

      // Utilizamos Promise.all para esperar que todas las provincias se inserten
      await Promise.all(
        provincias.map(async (provincia) => {
          const existingProvincia = await this.ubigeoRepository.findOne({
            where: { code: provincia.id },
          });

          if (existingProvincia) {
            this.logger.debug(
              `Provincia existente encontrada: ${provincia.id}`,
            );
            return;
          }

          const departamento = await this.ubigeoRepository.findOne({
            where: { code: provincia.department_id },
          });

          if (!departamento) {
            this.logger.error(
              `Departamento no encontrado para provincia ${provincia.id}`,
            );
            return;
          }

          const newProvincia = this.ubigeoRepository.create({
            name: provincia.name,
            code: provincia.id,
            parentId: departamento.id,
          });

          await this.ubigeoRepository.save(newProvincia);
          this.logger.log(`Provincia creada exitosamente: ${provincia.id}`);
        }),
      );
      this.logger.log('Todas las provincias han sido procesadas.');

      this.logger.log('Iniciando inserción de distritos...');
      const distritos = distritosData;

      await Promise.all(
        distritos.map(async (distrito) => {
          const existingDistrito = await this.ubigeoRepository.findOne({
            where: { code: distrito.id },
          });

          if (existingDistrito) {
            this.logger.debug(`Distrito existente encontrado: ${distrito.id}`);
            return;
          }

          const provincia = await this.ubigeoRepository.findOne({
            where: { code: distrito.province_id },
          });

          if (!provincia) {
            this.logger.error(
              `Provincia no encontrada para distrito ${distrito.id}`,
            );
            return;
          }

          const newDistrito = this.ubigeoRepository.create({
            name: distrito.name,
            code: distrito.id,
            parentId: provincia.id,
          });

          await this.ubigeoRepository.save(newDistrito);
          this.logger.log(`Distrito creado exitosamente: ${distrito.id}`);
        }),
      );
      this.logger.log('Todos los distritos han sido procesados.');

      this.logger.log('Seed de ubigeo completado exitosamente.');
    } catch (error) {
      this.logger.error(`Error en seedUbigeo: ${error.message}`);
      throw error;
    }
  }

  async seedAll() {
    this.logger.log('Iniciando proceso de seed completo...');
    try {
      const startTime = Date.now();
      await this.seedViews();
      await this.seedRoles();
      await this.seedUbigeo();
      const duration = Date.now() - startTime;
      this.logger.log(`Seed completo exitosamente en ${duration}ms`);
      return {
        success: true,
        duration: `${duration}ms`,
        message: 'Seed completado exitosamente',
      };
    } catch (error) {
      this.logger.error(`Error durante el seed: ${error.message}`);
      throw error;
    }
  }

  async seedMembershipPlans() {
    this.logger.log('Iniciando seed de planes de membresía...');
    try {
      const results = await Promise.all(
        membershipPlansData.map(async (planData) => {
          try {
            const existingPlan = await this.membershipPlanRepository.findOne({
              where: { name: planData.name },
            });

            if (existingPlan) {
              this.logger.debug(
                `Plan de membresía existente encontrado: ${planData.name}`,
              );
              return { status: 'existing', name: planData.name };
            }

            const plan = this.membershipPlanRepository.create({
              name: planData.name,
              price: planData.price,
              checkAmount: planData.checkAmount,
              binaryPoints: planData.binaryPoints,
              commissionPercentage: planData.commissionPercentage,
              directCommissionAmount: planData.directCommissionAmount,
              products: planData.products,
              benefits: planData.benefits,
              isActive: planData.isActive,
              displayOrder: planData.displayOrder,
            });

            await this.membershipPlanRepository.save(plan);
            this.logger.log(
              `Plan de membresía creado exitosamente: ${planData.name}`,
            );
            return { status: 'created', name: planData.name };
          } catch (error) {
            this.logger.error(
              `Error al crear plan de membresía ${planData.name}: ${error.message}`,
            );
            return {
              status: 'error',
              name: planData.name,
              error: error.message,
            };
          }
        }),
      );

      const created = results.filter((r) => r.status === 'created').length;
      const existing = results.filter((r) => r.status === 'existing').length;
      const errors = results.filter((r) => r.status === 'error').length;
      this.logger.log(
        `Seed de planes de membresía completado. Creados: ${created}, Existentes: ${existing}, Errores: ${errors}`,
      );

      return {
        created,
        existing,
        errors,
        details: results,
      };
    } catch (error) {
      this.logger.error(
        `Error general en seedMembershipPlans: ${error.message}`,
      );
      throw error;
    }
  }

  async seedPaymentConfigs() {
    this.logger.log('Iniciando seed de configuraciones de pago...');
    try {
      const results = await Promise.all(
        paymentConfigsData.map(async (configData) => {
          try {
            const existingConfig = await this.paymentConfigRepository.findOne({
              where: { code: configData.code },
            });

            if (existingConfig) {
              this.logger.debug(
                `Configuración de pago existente encontrada: ${configData.code}`,
              );

              Object.assign(existingConfig, configData);
              await this.paymentConfigRepository.save(existingConfig);

              return { status: 'updated', code: configData.code };
            }

            const config = this.paymentConfigRepository.create({
              code: configData.code,
              name: configData.name,
              description: configData.description,
              requiresApproval: configData.requiresApproval,
              isActive: configData.isActive,
              minimumAmount: configData.minimumAmount,
              maximumAmount: configData.maximumAmount,
            });

            await this.paymentConfigRepository.save(config);
            this.logger.log(
              `Configuración de pago creada exitosamente: ${configData.code}`,
            );
            return { status: 'created', code: configData.code };
          } catch (error) {
            this.logger.error(
              `Error al crear configuración de pago ${configData.code}: ${error.message}`,
            );
            return {
              status: 'error',
              code: configData.code,
              error: error.message,
            };
          }
        }),
      );

      const created = results.filter((r) => r.status === 'created').length;
      const updated = results.filter((r) => r.status === 'updated').length;
      const errors = results.filter((r) => r.status === 'error').length;
      this.logger.log(
        `Seed de configuraciones de pago completado. Creados: ${created}, Actualizados: ${updated}, Errores: ${errors}`,
      );

      return {
        created,
        updated,
        errors,
        details: results,
      };
    } catch (error) {
      this.logger.error(
        `Error general en seedPaymentConfigs: ${error.message}`,
      );
      throw error;
    }
  }

  async seedWithdrawalConfigs() {
    this.logger.log('Iniciando seed de configuraciones de retiro...');
    try {
      const results = await Promise.all(
        withdrawalConfigsData.map(async (configData) => {
          try {
            const existingConfig =
              await this.withdrawalConfigRepository.findOne({
                where: { code: configData.code },
              });

            if (existingConfig) {
              this.logger.debug(
                `Configuración de retiro existente encontrada: ${configData.code}`,
              );

              Object.assign(existingConfig, configData);
              await this.withdrawalConfigRepository.save(existingConfig);

              return { status: 'updated', code: configData.code };
            }

            const config = this.withdrawalConfigRepository.create({
              code: configData.code,
              name: configData.name,
              description: configData.description,
              requiresApproval: configData.requiresApproval,
              isActive: configData.isActive,
              minimumAmount: configData.minimumAmount,
              maximumAmount: configData.maximumAmount,
              startHour: configData.startHour,
              endHour: configData.endHour,
              enabledWeekDays: configData.enabledWeekDays,
            });

            await this.withdrawalConfigRepository.save(config);
            this.logger.log(
              `Configuración de retiro creada exitosamente: ${configData.code}`,
            );
            return { status: 'created', code: configData.code };
          } catch (error) {
            this.logger.error(
              `Error al crear configuración de retiro ${configData.code}: ${error.message}`,
            );
            return {
              status: 'error',
              code: configData.code,
              error: error.message,
            };
          }
        }),
      );

      const created = results.filter((r) => r.status === 'created').length;
      const updated = results.filter((r) => r.status === 'updated').length;
      const errors = results.filter((r) => r.status === 'error').length;
      this.logger.log(
        `Seed de configuraciones de retiro completado. Creados: ${created}, Actualizados: ${updated}, Errores: ${errors}`,
      );

      return {
        created,
        updated,
        errors,
        details: results,
      };
    } catch (error) {
      this.logger.error(
        `Error general en seedWithdrawalConfigs: ${error.message}`,
      );
      throw error;
    }
  }

  async seedUsers(): Promise<any> {
    this.logger.log('Iniciando seed de usuarios específicos...');
    const startTime = Date.now();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sysRole = await this.roleRepository.findOne({
        where: { code: 'SYS' },
      });
      const adminRole = await this.roleRepository.findOne({
        where: { code: 'ADM' },
      });
      const facRole = await this.roleRepository.findOne({
        where: { code: 'FAC' },
      });
      const clientRole = await this.roleRepository.findOne({
        where: { code: 'CLI' },
      });

      if (!sysRole || !adminRole || !facRole || !clientRole) {
        throw new Error(
          'No se encontraron todos los roles necesarios. Ejecuta primero el seed de roles.',
        );
      }

      const surcoUbigeo = await this.ubigeoRepository.findOne({
        where: { name: 'SANTIAGO DE SURCO' },
      });

      const defaultUbigeo = await this.ubigeoRepository.findOne({
        where: { code: '150101' },
      });

      if (!defaultUbigeo) {
        throw new Error(
          'No hay ubicaciones (ubigeos) disponibles en el sistema. Ejecuta primero el seed de ubigeos.',
        );
      }
      const defaultPass = 'NexusPass%2025';
      const masterUser = await this.createSpecificUser(
        {
          email: 'cesar.huertas@inmobiliariahuertas.com',
          password: defaultPass,
          role: clientRole,
          firstName: 'César',
          lastName: 'Huertas Anaya',
          gender: 'MASCULINO',
          birthDate: new Date('1994-05-21'),
          phone: '941290426',
          address: 'Polo Hunt, Surco',
          ubigeo: surcoUbigeo || defaultUbigeo,
        },
        null,
        null,
        queryRunner,
      );

      this.logger.log(`Usuario master creado: ${masterUser.email}`);

      const systemUser = await this.createSpecificUser(
        {
          email: 'softwaretoni21@gmail.com',
          password: defaultPass,
          role: sysRole,
          firstName: 'Anthoni',
          lastName: 'Portocarrero Rodriguez',
          gender: 'MASCULINO',
          birthDate: new Date('1999-12-21'),
          phone: '958920823',
          address: 'Mi Casa 123',
          ubigeo: defaultUbigeo,
        },
        null,
        null,
        queryRunner,
      );

      this.logger.log(`Usuario sistema creado: ${systemUser.email}`);

      const adminUser = await this.createSpecificUser(
        {
          email: 'admin@nexusplatform.com',
          password: defaultPass,
          role: adminRole,
          firstName: 'Nexus',
          lastName: 'Adm',
          gender: 'MASCULINO',
          birthDate: new Date('1990-01-01'),
          phone: '999888777',
          address: 'Oficina Nexus 123',
          ubigeo: defaultUbigeo,
        },
        null,
        null,
        queryRunner,
      );

      this.logger.log(`Usuario admin creado: ${adminUser.email}`);

      const financeUser = await this.createSpecificUser(
        {
          email: 'finanzas@nexusplatform.com',
          password: defaultPass,
          role: facRole,
          firstName: 'Finanzas',
          lastName: 'Nexus',
          gender: 'FEMENINO',
          birthDate: new Date('1995-06-15'),
          phone: '987654321',
          address: 'Área Finanzas, Oficina Central',
          ubigeo: defaultUbigeo,
        },
        null,
        null,
        queryRunner,
      );

      this.logger.log(`Usuario finanzas creado: ${financeUser.email}`);

      await queryRunner.commitTransaction();

      const duration = Date.now() - startTime;
      this.logger.log(
        `Seed de usuarios específicos completado en ${duration}ms`,
      );

      return {
        success: true,
        duration: `${duration}ms`,
        userCount: 4,
        users: [
          {
            id: masterUser.id,
            email: masterUser.email,
            name: `${masterUser.personalInfo.firstName} ${masterUser.personalInfo.lastName}`,
            role: masterUser.role.name,
          },
          {
            id: systemUser.id,
            email: systemUser.email,
            name: `${systemUser.personalInfo.firstName} ${systemUser.personalInfo.lastName}`,
            role: systemUser.role.name,
          },
          {
            id: adminUser.id,
            email: adminUser.email,
            name: `${adminUser.personalInfo.firstName} ${adminUser.personalInfo.lastName}`,
            role: adminUser.role.name,
          },
          {
            id: financeUser.id,
            email: financeUser.email,
            name: `${financeUser.personalInfo.firstName} ${financeUser.personalInfo.lastName}`,
            role: financeUser.role.name,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Error en seed de usuarios: ${error.message}`);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async createSpecificUser(
    userData: {
      email: string;
      password: string;
      role: Role;
      firstName: string;
      lastName: string;
      gender: string;
      birthDate: Date;
      phone: string;
      address: string;
      ubigeo: Ubigeo;
    },
    parent: User | null,
    position: 'LEFT' | 'RIGHT' | null,
    queryRunner: any,
  ): Promise<User> {
    // Generar código de referido único
    const referralCode = this.generateReferralCode();

    // Crear usuario
    const user = new User();
    user.email = userData.email;
    user.password = await this.hashPassword(userData.password);
    user.referralCode = referralCode;
    user.role = userData.role;
    user.isActive = true;

    if (parent) {
      user.parent = parent;
      user.position = position;
      user.referrerCode = parent.referralCode;
    }

    const savedUser = await queryRunner.manager.save(user);

    // Crear información personal
    const personalInfo = new PersonalInfo();
    personalInfo.firstName = userData.firstName;
    personalInfo.lastName = userData.lastName;
    personalInfo.gender = userData.gender;
    personalInfo.birthDate = userData.birthDate;
    personalInfo.user = savedUser;

    const savedPersonalInfo = await queryRunner.manager.save(personalInfo);
    savedUser.personalInfo = savedPersonalInfo;

    // Crear información de contacto
    const contactInfo = new ContactInfo();
    contactInfo.phone = userData.phone;
    contactInfo.address = userData.address;
    contactInfo.ubigeo = userData.ubigeo;
    contactInfo.user = savedUser;

    const savedContactInfo = await queryRunner.manager.save(contactInfo);
    savedUser.contactInfo = savedContactInfo;

    return savedUser;
  }

  private generateReferralCode(): string {
    return uuidv4().substring(0, 8).toUpperCase();
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async seedRanks() {
    this.logger.log('Iniciando seed de rangos...');
    try {
      const results = await Promise.all(
        rankData.map(async (rankItem) => {
          try {
            const existingRank = await this.rankRepository.findOne({
              where: { code: rankItem.code },
            });

            if (existingRank) {
              this.logger.debug(`Rango existente encontrado: ${rankItem.code}`);
              return { status: 'existing', code: rankItem.code };
            }

            const rank = this.rankRepository.create(rankItem);
            await this.rankRepository.save(rank);
            this.logger.log(`Rango creado exitosamente: ${rankItem.code}`);
            return { status: 'created', code: rankItem.code };
          } catch (error) {
            this.logger.error(
              `Error al crear rango ${rankItem.code}: ${error.message}`,
            );
            return {
              status: 'error',
              code: rankItem.code,
              error: error.message,
            };
          }
        }),
      );

      const created = results.filter((r) => r.status === 'created').length;
      const existing = results.filter((r) => r.status === 'existing').length;
      const errors = results.filter((r) => r.status === 'error').length;
      this.logger.log(
        `Seed de rangos completado. Creados: ${created}, Existentes: ${existing}, Errores: ${errors}`,
      );
    } catch (error) {
      this.logger.error(`Error en seedRanks: ${error.message}`);
      throw error;
    }
  }
}
