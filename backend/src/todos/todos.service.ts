import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  list(ownerUid: string) {
    return this.prisma.todo.findMany({ where: { ownerUid }, orderBy: { createdAt: 'desc' } });
  }

  create(ownerUid: string, title: string) {
    return this.prisma.todo.create({ data: { ownerUid, title } });
  }

  async toggle(ownerUid: string, id: string) {
    const todo = await this.prisma.todo.findFirst({ where: { id, ownerUid } });
    if (!todo) throw new NotFoundException('Todo not found');
    return this.prisma.todo.update({ where: { id }, data: { done: !todo.done } });
  }
}
