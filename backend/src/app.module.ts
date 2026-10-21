import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { TodosController } from './todos/todos.controller';
import { TodosService } from './todos/todos.service';

@Module({
  controllers: [HealthController, TodosController],
  providers: [PrismaService, TodosService],
})
export class AppModule {}
