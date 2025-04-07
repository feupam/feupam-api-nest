import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  comment: string;

  @IsString()
  @IsOptional()
  emailUser: string;

  @IsBoolean()
  @IsOptional()
  hide: boolean;
}
