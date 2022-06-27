import { Request, Response } from 'express';
import { singleton } from 'tsyringe';
import { HttpStatus } from '../../core/lib/http-status';
import { UserService } from '../user.service';
import { verifyToken } from '../../core/middlewares/verify.token';
import { scope } from '../../core/middlewares/access.user';
import { Controller, Delete, Get, Middleware, Put } from '../../core/decorators';

@singleton()
@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}
  @Get('')
  async getUserNames(req: Request, resp: Response) {
    const users = await this.userService.getUserNames();
    resp.json(users);
  }

  @Get(':id')
  @Middleware([verifyToken])
  async getUser(req: Request, resp: Response) {
    const { id } = req.params;
    const { jwt } = resp.locals;

    const user = await this.userService.getUser(id);

    if (scope(jwt.id, user.id)) {
      resp.status(HttpStatus.UNAUTHORIZED).json('Unauthorized');
      return;
    }
    const { password, ...others } = user;
    resp.json(others);
  }
  @Put(':id')
  @Middleware([verifyToken])
  async updateUser(req: Request, resp: Response) {
    const { id } = req.params;
    const { jwt } = resp.locals;
    const user = await this.userService.getUser(id);

    if (scope(jwt.id, user.id)) {
      resp.status(HttpStatus.UNAUTHORIZED).json('Unauthorized');
      return;
    }
    const updated = await this.userService.updateUser(id, req.body);
    resp.status(HttpStatus.OK).json(updated);
  }

  @Delete(':id')
  @Middleware([verifyToken])
  async removeUser(req: Request, resp: Response) {
    const { id } = req.params;
    const { jwt } = resp.locals;
    const user = await this.userService.getUser(id);

    if (scope(jwt.id, user.id)) {
      resp.status(HttpStatus.UNAUTHORIZED).json('Unauthorized');
      return;
    }
    const removed = await this.userService.removeUser(id);

    resp.status(HttpStatus.OK).json(removed);
  }
}