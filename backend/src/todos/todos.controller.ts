import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser, FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { TodosService } from './todos.service';

@Controller('todos')
@UseGuards(FirebaseAuthGuard)
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.todos.list(user.uid);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { title?: string }) {
    const title = body.title?.trim();
    if (!title) throw new BadRequestException('title is required');
    return this.todos.create(user.uid, title);
  }

  @Patch(':id/toggle')
  toggle(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.todos.toggle(user.uid, id);
  }
}
