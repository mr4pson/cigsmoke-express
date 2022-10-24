import { CheckoutStatus } from 'core/enums/checkout-status.enum';
import { Role } from '../../core/enums/roles.enum';
import { Request, Response } from 'express';
import { singleton } from 'tsyringe';
import { Controller, Delete, Get, Middleware, Post, Put } from '../../core/decorators';
import { Checkout } from '../../core/entities';
import { HttpStatus } from '../../core/lib/http-status';
import { validation } from '../../core/lib/validator';
import { isAdmin, isUser, verifyToken } from '../../core/middlewares';
import { createInvoice } from '../../orders/functions/createInvoice';
import { sendInvoice } from '../../orders/functions/send.mail';
import { CheckoutService } from './checkout.service';

@singleton()
@Controller('/checkouts')
export class CheckoutController {
  constructor(private checkoutService: CheckoutService) {}

  @Get()
  @Middleware([verifyToken, isUser])
  async getCheckouts(req: Request, resp: Response) {
    // if (resp.locals.user.role !== Role.Admin) {
    //   req.query.userId = String(resp.locals.user.id);
    // }

    const checkouts = await this.checkoutService.getCheckouts(
      req.query,
      req.headers.authorization!,
      resp.locals.user.id,
    );

    resp.json(checkouts);
  }

  @Get('all')
  @Middleware([verifyToken, isAdmin])
  async getAllCheckouts(req: Request, resp: Response) {
    const checkouts = await this.checkoutService.getAllCheckouts(req.query, req.headers.authorization!);

    resp.json(checkouts);
  }

  @Get(':id')
  @Middleware([verifyToken, isUser])
  async getCheckout(req: Request, resp: Response) {
    const { id } = req.params;
    const checkout = await this.checkoutService.getCheckout(id, req.headers.authorization!);

    resp.json(checkout);
  }

  @Post()
  @Middleware([verifyToken, isUser])
  async createCheckout(req: Request, resp: Response) {
    const newCheckout = new Checkout(req.body);
    newCheckout.userId = resp.locals.user.id;
    const name = resp.locals.user.name;

    await validation(newCheckout);
    const created = await this.checkoutService.createCheckout(newCheckout);

    // const invoice = await createInvoice(created!, { name });
    // sendInvoice(invoice, resp.locals.user.email);
    resp.status(HttpStatus.CREATED).json(created);
  }

  @Put(':id')
  @Middleware([verifyToken, isUser])
  async updateCheckout(req: Request, resp: Response) {
    const { id } = req.params;
    const { jwt } = resp.locals;
    try {
      const checkoutsById = await this.checkoutService.getCheckout(id, req.headers.authorization!);
      if (!checkoutsById) {
        resp.status(HttpStatus.NOT_FOUND).json({ message: 'Not found!' });
        return;
      }
      const timeCheck = (orderDate: any) => {
        const oneDay = 24 * 60 * 60 * 1000;
        const currentDate = new Date().getTime();
        const dateOnDB = new Date(orderDate).getTime() + oneDay;
        return currentDate >= dateOnDB;
      };

      if (timeCheck(checkoutsById.createdAt) && jwt.role !== Role.Admin) {
        resp.status(HttpStatus.REQUEST_TIMEOUT).json({ message: 'request timedout' });
        return;
      }
      if (jwt.role !== Role.Admin) {
        req.body.sattus = checkoutsById.status;
        const usedrCheckoutUpdated = await this.checkoutService.updateCheckout(id, req.body, resp.locals.user);
        resp.status(HttpStatus.OK).json(usedrCheckoutUpdated);
        return;
      }
      const updated = await this.checkoutService.updateCheckout(id, req.body, resp.locals.user);

      resp.status(HttpStatus.OK).json(updated);
    } catch (error) {
      resp.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: `somthing went wrong: ${error}` });
    }
  }

  @Delete(':id')
  @Middleware([verifyToken, isAdmin])
  async removeCheckout(req: Request, resp: Response) {
    const { id } = req.params;
    const removed = await this.checkoutService.removeCheckout(id, resp.locals.user);

    resp.status(HttpStatus.OK).json(removed);
  }
}
