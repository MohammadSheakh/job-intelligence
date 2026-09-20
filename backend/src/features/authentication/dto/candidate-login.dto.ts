import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CandidateLoginDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}
