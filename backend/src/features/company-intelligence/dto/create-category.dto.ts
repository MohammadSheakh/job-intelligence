import { IsIn, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @MaxLength(120) name!: string;
  @IsIn(['technology', 'domain', 'sector', 'other']) type!: 'technology' | 'domain' | 'sector' | 'other';
}
