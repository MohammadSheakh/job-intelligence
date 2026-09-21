import { IsIn, IsString, MaxLength } from 'class-validator';

/** Restricts category types to the database policy; category identity is its normalized name. */
export class CreateCategoryDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(['technology', 'domain', 'sector', 'other'])
  type!: 'technology' | 'domain' | 'sector' | 'other';
}
