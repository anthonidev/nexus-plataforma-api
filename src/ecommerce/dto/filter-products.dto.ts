import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/paginationDto';

export class FindProductsDto extends PaginationDto {
    @ApiProperty({ example: 'Colágeno Renew', type: String, required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ example: 1, type: Number, required: false })
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseInt(value))
    categoryId?: number;

    @ApiProperty({ example: true, type: Boolean, required: false })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    isActive?: boolean;
}