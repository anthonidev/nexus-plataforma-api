import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { User } from 'src/user/entities/user.entity';
import { View } from 'src/user/entities/view.entity';
import { In, Repository } from 'typeorm';
import { rolData, vistaData } from './data/auth.data';
import {
  departamentosData,
  distritosData,
  provinciasData,
} from './data/ubigeo.data';
import { Role } from 'src/user/entities/roles.entity';
import { Ubigeo } from 'src/user/entities/ubigeo.entity';
import { Linter } from 'eslint';
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);
  constructor(
    @InjectRepository(View)
    private readonly viewRepository: Repository<View>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Ubigeo)
    private readonly ubigeoRepository: Repository<Ubigeo>,
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
}
