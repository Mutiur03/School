import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Auth } from '../../common/auth.guard.js';
import { CreateLevelDto } from './dto/create-level.dto.js';
import { UpdateLevelDto } from './dto/update-level.dto.js';
import { LevelService } from './level.service.js';

/** Class-teacher assignments (admin). */
@Controller('levels')
@UseGuards(Auth('admin'))
export class LevelController {
  constructor(private readonly levels: LevelService) {}

  @Get()
  findAll() {
    return this.levels.getAllLevels();
  }

  @Post()
  create(@Body() dto: CreateLevelDto) {
    return this.levels.addLevel(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLevelDto) {
    return this.levels.updateLevel(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.levels.deleteLevel(id);
  }
}
