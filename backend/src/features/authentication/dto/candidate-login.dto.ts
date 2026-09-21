import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Validates login input without exposing whether an account exists. */
export class CandidateLoginDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}
