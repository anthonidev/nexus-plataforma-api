import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Role } from 'src/user/entities/roles.entity';
import { Ubigeo } from 'src/user/entities/ubigeo.entity';
import { User } from 'src/user/entities/user.entity';
import { View } from 'src/user/entities/view.entity';
import { DataSource, In, Repository } from 'typeorm';
import { rolData, vistaData } from './data/auth.data';
import {
  departamentosData,
  distritosData,
  provinciasData,
} from './data/ubigeo.data';
import { PersonalInfo } from 'src/user/entities/personal-info.entity';
import { ContactInfo } from 'src/user/entities/contact-info.entity';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { MembershipPlan } from 'src/memberships/entities/membership-plan.entity';
import { membershipPlansData } from './data/membership-plans.data';
import { paymentConfigsData } from './data/payment-configs.data';
import { PaymentConfig } from 'src/payments/entities/payment-config.entity';
import { rankData } from './data/rank.data';
import { Rank } from 'src/points/entities/ranks.entity';
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

      // PASO 3: Insertar todos los distritos después de que departamentos y provincias estén listos
      this.logger.log('Iniciando inserción de distritos...');
      const distritos = distritosData;

      // Utilizamos Promise.all para esperar que todos los distritos se inserten
      await Promise.all(
        distritos.map(async (distrito) => {
          const existingDistrito = await this.ubigeoRepository.findOne({
            where: { code: distrito.id },
          });

          if (existingDistrito) {
            this.logger.debug(`Distrito existente encontrado: ${distrito.id}`);
            return;
          }

          // Ahora usamos province_id para obtener la provincia correcta
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
  async seedUsers(count: number = 2000): Promise<any> {
    this.logger.log(`Iniciando seed de ${count} usuarios...`);
    const startTime = Date.now();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Buscar un rol válido para los usuarios
      const roles = await this.roleRepository.find({
        where: { isActive: true },
      });
      if (roles.length === 0) {
        throw new Error('No hay roles disponibles en el sistema');
      }

      // Buscar ubicaciones (ubigeos) disponibles
      const ubigeos = await this.ubigeoRepository.find({ take: 100 });
      if (ubigeos.length === 0) {
        throw new Error(
          'No hay ubicaciones (ubigeos) disponibles en el sistema',
        );
      }

      // Crear usuario maestro (root)
      const masterUser = await this.createMasterUser(
        roles[0],
        ubigeos[0],
        queryRunner,
      );
      this.logger.log(`Usuario maestro creado: ${masterUser.email}`);

      // Crear usuarios adicionales uno por uno
      const userNodes = [masterUser]; // Lista de nodos donde podemos insertar nuevos hijos

      for (let i = 0; i < count; i++) {
        if (i % 100 === 0) {
          this.logger.log(`Progreso: ${i}/${count} usuarios creados`);
        }

        // Seleccionar un rol aleatorio
        const randomRole = roles[Math.floor(Math.random() * roles.length)];

        // Seleccionar un ubigeo aleatorio
        const randomUbigeo =
          ubigeos[Math.floor(Math.random() * ubigeos.length)];

        // Seleccionar un nodo padre aleatorio de los disponibles
        const parentIndex = Math.floor(Math.random() * userNodes.length);
        const parentUser = userNodes[parentIndex];

        // Determinar en qué posición (izquierda o derecha) colocar al nuevo usuario
        let position: 'LEFT' | 'RIGHT' = null;

        if (!parentUser.leftChild) {
          position = 'LEFT';
        } else if (!parentUser.rightChild) {
          position = 'RIGHT';
        } else {
          // Este nodo ya tiene ambos hijos, así que debemos elegir otro nodo
          // Quitar este nodo de la lista de posibles padres
          userNodes.splice(parentIndex, 1);
          // Reintentar con otro nodo (decrementamos i para no perder la iteración)
          i--;
          continue;
        }

        // Crear el nuevo usuario
        const newUser = await this.createRandomUser(
          randomRole,
          randomUbigeo,
          parentUser,
          position,
          queryRunner,
        );

        // Actualizar referencia en el padre
        if (position === 'LEFT') {
          parentUser.leftChild = newUser;
        } else {
          parentUser.rightChild = newUser;
        }
        await queryRunner.manager.save(parentUser);

        userNodes.push(newUser);
      }

      await queryRunner.commitTransaction();

      const duration = Date.now() - startTime;
      this.logger.log(`Seed de usuarios completado en ${duration}ms`);

      return {
        success: true,
        duration: `${duration}ms`,
        userCount: count + 1, // +1 por el usuario maestro
        masterUser: {
          id: masterUser.id,
          email: masterUser.email,
          referralCode: masterUser.referralCode,
        },
      };
    } catch (error) {
      this.logger.error(`Error en seed de usuarios: ${error.message}`);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async seedMembershipPlans() {
    this.logger.log('Iniciando seed de planes de membresía...');
    try {
      const results = await Promise.all(
        membershipPlansData.map(async (planData) => {
          try {
            // Verificar si el plan ya existe por nombre
            const existingPlan = await this.membershipPlanRepository.findOne({
              where: { name: planData.name },
            });

            if (existingPlan) {
              this.logger.debug(
                `Plan de membresía existente encontrado: ${planData.name}`,
              );
              return { status: 'existing', name: planData.name };
            }

            // Crear el nuevo plan
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
            // Verificar si la configuración ya existe por código
            const existingConfig = await this.paymentConfigRepository.findOne({
              where: { code: configData.code },
            });

            if (existingConfig) {
              this.logger.debug(
                `Configuración de pago existente encontrada: ${configData.code}`,
              );

              // Opcionalmente, podemos actualizar la configuración existente
              // para mantenerla al día con cambios en los datos
              Object.assign(existingConfig, configData);
              await this.paymentConfigRepository.save(existingConfig);

              return { status: 'updated', code: configData.code };
            }

            // Crear la nueva configuración
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

  private async createMasterUser(
    role: Role,
    ubigeo: Ubigeo,
    queryRunner: any,
  ): Promise<User> {
    // Generar código de referido único
    const referralCode = this.generateReferralCode();

    // Crear usuario
    const user = new User();
    user.email = 'master@example.com';
    user.password = await this.hashPassword('Master123');
    user.referralCode = referralCode;
    user.role = role;
    user.isActive = true;

    const savedUser = await queryRunner.manager.save(user);

    // Crear información personal
    const personalInfo = new PersonalInfo();
    personalInfo.firstName = 'Usuario';
    personalInfo.lastName = 'Maestro';
    personalInfo.gender = 'MASCULINO';
    personalInfo.birthDate = new Date('1980-01-01');
    personalInfo.user = savedUser;
    await queryRunner.manager.save(personalInfo);

    // Crear información de contacto
    const contactInfo = new ContactInfo();
    contactInfo.phone = '999999999';
    contactInfo.address = 'Calle Principal 123';
    contactInfo.ubigeo = ubigeo;
    contactInfo.user = savedUser;
    await queryRunner.manager.save(contactInfo);

    return savedUser;
  }

  private async createRandomUser(
    role: Role,
    ubigeo: Ubigeo,
    parent: User,
    position: 'LEFT' | 'RIGHT',
    queryRunner: any,
  ): Promise<User> {
    // Generar código de referido único
    const referralCode = this.generateReferralCode();

    // Crear usuario
    const user = new User();
    user.email = faker.internet.email().toLowerCase();
    user.password = await this.hashPassword('Password123');
    user.referralCode = referralCode;
    user.referrerCode = parent.referralCode; // El código de referido del padre
    user.role = role;
    user.isActive = Math.random() > 0.1; // 90% de usuarios activos
    user.parent = parent;
    user.position = position;

    const savedUser = await queryRunner.manager.save(user);

    // Crear información personal
    const personalInfo = new PersonalInfo();
    personalInfo.firstName = faker.person.firstName();
    personalInfo.lastName = faker.person.lastName();
    personalInfo.gender = faker.helpers.arrayElement([
      'MASCULINO',
      'FEMENINO',
      'OTRO',
    ]);
    personalInfo.birthDate = faker.date.between({
      from: '1950-01-01',
      to: '2000-12-31',
    });
    personalInfo.user = savedUser;
    await queryRunner.manager.save(personalInfo);

    // Crear información de contacto
    const contactInfo = new ContactInfo();
    contactInfo.phone = faker.string.numeric({ length: 9 });
    contactInfo.address = faker.location.streetAddress();
    contactInfo.ubigeo = ubigeo;
    contactInfo.user = savedUser;
    await queryRunner.manager.save(contactInfo);

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
