import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ubigeo } from '../entities/ubigeo.entity';
@Injectable()
export class UbigeoService {
  constructor(
    @InjectRepository(Ubigeo)
    private readonly ubigeoRepository: Repository<Ubigeo>,
  ) {}
  async findAll() {
    const departamentos = await this.ubigeoRepository
      .createQueryBuilder('departamento')
      .leftJoinAndSelect('departamento.children', 'provincia')
      .leftJoinAndSelect('provincia.children', 'distrito')
      .where('departamento.parentId IS NULL')
      .orderBy('departamento.name', 'ASC')
      .addOrderBy('provincia.name', 'ASC')
      .addOrderBy('distrito.name', 'ASC')
      .getMany();
    return departamentos;
  }
  async findById(id: number) {
    const ubigeo = await this.ubigeoRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
    if (!ubigeo) {
      throw new NotFoundException(`Ubigeo con ID ${id} no encontrado`);
    }
    return ubigeo;
  }
  async getFullPath(ubigeoId: number) {
    const ubigeo = await this.findById(ubigeoId);
    if (!ubigeo.parent) {
      return {
        department: ubigeo,
        province: null,
        district: null,
      };
    }
    if (ubigeo.parent && !ubigeo.parent.parent) {
      return {
        department: ubigeo.parent,
        province: ubigeo,
        district: null,
      };
    }
    if (ubigeo.parent && ubigeo.parent.parent) {
      return {
        department: ubigeo.parent.parent,
        province: ubigeo.parent,
        district: ubigeo,
      };
    }
  }
}
