import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BinaryService } from './binary.service';
import { CreateBinaryDto } from './dto/create-binary.dto';
import { UpdateBinaryDto } from './dto/update-binary.dto';

@Controller('binary')
export class BinaryController {
  constructor(private readonly binaryService: BinaryService) {}

  @Post()
  create(@Body() createBinaryDto: CreateBinaryDto) {
    return this.binaryService.create(createBinaryDto);
  }

  @Get()
  findAll() {
    return this.binaryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.binaryService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBinaryDto: UpdateBinaryDto) {
    return this.binaryService.update(+id, updateBinaryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.binaryService.remove(+id);
  }
}
