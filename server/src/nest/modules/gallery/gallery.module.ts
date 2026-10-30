import { Module } from '@nestjs/common';
import { GalleryService } from './gallery.service.js';
import { GalleryController } from './gallery.controller.js';

@Module({ providers: [GalleryService], controllers: [GalleryController] })
export class GalleryModule {}
