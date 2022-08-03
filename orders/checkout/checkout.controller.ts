import { Controller, Delete, Get, Middleware, Post, Put } from '../../core/decorators';
import { Request, Response } from 'express';
import { singleton } from 'tsyringe';
import { Checkout } from '../../core/entities';
import { HttpStatus } from '../../core/lib/http-status';
import { validation } from '../../core/lib/validator';
import { CheckoutService } from './checkout.service';
import { isUser, verifyToken } from '../../core/middlewares';
import { Role } from '../../core/enums/roles.enum';

@singleton()
@Controller('/checkouts')
export class CheckoutController {
  constructor(private checkoutService: CheckoutService) {}

  @Get()
  // @Middleware([verifyToken, isUser])
  // TODO: add temporary token verification
  async getCheckouts(req: Request, resp: Response) {
    if (resp.locals.user.role !== Role.Admin) {
      req.query.userId = String(resp.locals.user.id);
    }

    const checkouts = await this.checkoutService.getCheckouts(req.query, req.headers.authorization!);

    resp.json(checkouts);
  }

  @Get(':id')
  // @Middleware([verifyToken, isUser])
  async getCheckout(req: Request, resp: Response) {
    const { id } = req.params;
    const checkout = await this.checkoutService.getCheckout(id, req.headers.authorization!);

    resp.json(checkout);
  }

  @Post()
  // @Middleware([verifyToken, isUser])
  async createCheckout(req: Request, resp: Response) {
    const newCheckout = new Checkout(req.body);
    newCheckout.userId = resp.locals.user.id;

    await validation(newCheckout);
    const created = await this.checkoutService.createCheckout(newCheckout, req.headers.authorization!);

    resp.status(HttpStatus.CREATED).json({ id: created.id });
  }

  @Put(':id')
  // @Middleware([verifyToken, isUser])
  async updateCheckout(req: Request, resp: Response) {
    const { id } = req.params;
    const updated = await this.checkoutService.updateCheckout(id, req.body, resp.locals.user);

    resp.status(HttpStatus.OK).json(updated);
  }

  @Delete(':id')
  // @Middleware([verifyToken, isUser])
  async removeCheckout(req: Request, resp: Response) {
    const { id } = req.params;
    const removed = await this.checkoutService.removeCheckout(id, resp.locals.user);

    resp.status(HttpStatus.OK).json(removed);
  }
}
