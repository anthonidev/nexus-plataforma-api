import { Injectable } from '@nestjs/common';
import { CreateBinaryDto } from './dto/create-binary.dto';
import { UpdateBinaryDto } from './dto/update-binary.dto';

@Injectable()
export class BinaryService {
  create(createBinaryDto: CreateBinaryDto) {
    return 'This action adds a new binary';
  }

  findAll() {
    return `This action returns all binary`;
  }

  findOne(id: number) {
    return `This action returns a #${id} binary`;
  }

  update(id: number, updateBinaryDto: UpdateBinaryDto) {
    return `This action updates a #${id} binary`;
  }

  remove(id: number) {
    return `This action removes a #${id} binary`;
  }
}
