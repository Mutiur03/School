import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, Max, Min, ValidateNested } from 'class-validator';

export const PASS_RULE_CLASSES = [6, 7, 8, 9, 10];

export class PassRuleDto {
  @IsIn(PASS_RULE_CLASSES)
  class!: number;

  @IsInt()
  @Min(0)
  @Max(15)
  max_failed!: number;
}

export class PassRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassRuleDto)
  rules!: PassRuleDto[];
}
