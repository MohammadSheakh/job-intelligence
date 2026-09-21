import { IsString, MaxLength, MinLength } from 'class-validator';

/** Applies password-length policy before candidate hashing and persistence. */
export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}
