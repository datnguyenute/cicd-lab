import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TodosService } from './todos.service';

describe('TodosService', () => {
  const prisma = {
    todo: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new TodosService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('only lists todos of the current user', async () => {
    prisma.todo.findMany.mockResolvedValue([]);
    await service.list('user-1');
    expect(prisma.todo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUid: 'user-1' } }),
    );
  });

  it('toggles done flag', async () => {
    prisma.todo.findFirst.mockResolvedValue({ id: 't1', done: false });
    await service.toggle('user-1', 't1');
    expect(prisma.todo.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { done: true } });
  });

  it('toggles a done todo back to not done', async () => {
    prisma.todo.findFirst.mockResolvedValue({ id: 't1', done: true });
    await service.toggle('user-1', 't1');
    expect(prisma.todo.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { done: false } });
  });

  it('throws when toggling a todo of another user', async () => {
    prisma.todo.findFirst.mockResolvedValue(null);
    await expect(service.toggle('user-2', 't1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
