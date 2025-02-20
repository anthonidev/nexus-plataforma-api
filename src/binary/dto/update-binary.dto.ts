import { PartialType } from '@nestjs/mapped-types';
import { CreateBinaryDto } from './create-binary.dto';

export class UpdateBinaryDto extends PartialType(CreateBinaryDto) {}
