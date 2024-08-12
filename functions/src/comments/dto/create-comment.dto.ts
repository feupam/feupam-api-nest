import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  comment: string;

  @IsString()
  @IsNotEmpty()
  emailUser: string;

  @IsBoolean()
  @IsNotEmpty()
  hide: boolean;
}
