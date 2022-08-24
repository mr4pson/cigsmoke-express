import * as bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { singleton } from 'tsyringe';
import { Controller, Get, Middleware, Post, Put } from '../../core/decorators';
import { User } from '../../core/entities';
import { HttpStatus } from '../../core/lib/http-status';
import { Role } from '../../core/enums/roles.enum';
import { validation } from '../../core/lib/validator';
import { accessToken } from '../functions/access.token';
import { emailToken } from '../functions/email.token';
import { changePasswordLimiter, resetPasswordLimiter, sendTokenLimiter } from '../functions/rate.limit';
import { refreshToken } from '../functions/refresh.token';
import { sendMail, sendMailResetPsw } from '../functions/send.mail';
import { UserService } from '../services/user.service';

@singleton()
@Controller('/auth')
export class AuthController {
  constructor(private userService: UserService) {
    (async () => {
      const admin = await this.userService.getAdmin();

      if (!admin) {
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash('salmonella', salt);

        await this.userService.createUser({
          firstName: 'admin',
          lastName: 'admin',
          isVerified: true,
          email: 'admin@admin.ru',
          password: hashedPass,
          role: Role.Admin,
        } as any);
      }
    })();
  }

  @Get('init-admin')
  async initAdmin(req: Request, resp: Response) {
    const admin = await this.userService.getAdmin();

    if (!admin) {
      const salt = await bcrypt.genSalt(10);
      const hashedPass = await bcrypt.hash('salmonella', salt);

      const user = await this.userService.createUser({
        firstName: 'admin',
        lastName: 'admin',
        isVerified: true,
        email: 'admin@admin.ru',
        password: hashedPass,
        role: Role.Admin,
      } as any);

      resp.status(HttpStatus.CREATED).json({ user });

      return;
    }

    resp.status(HttpStatus.CREATED).json({ info: 'already exists', user: admin });
  }

  @Post('signup')
  async signUp(req: Request, resp: Response) {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPass = await bcrypt.hash(req.body.password, salt);
      const payload = {
        id: '',
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        isVerified: false,
        password: hashedPass,
        role: Role.User,
      };
      const isUser = await this.userService.getByEmail(payload.email);

      if (isUser) {
        resp.status(HttpStatus.CONFLICT).json({ message: 'Such user already exists.' });
        return;
      }

      const newUser = await validation(new User(payload));
      const created = await this.userService.createUser(newUser);
      const { password, ...others } = created;
      const token = emailToken({ id: created.id, email: created.email });

      sendMail(token, created.email);

      resp.status(HttpStatus.CREATED).json({ ...others, token });
    } catch (error) {
      resp.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: `somthing went wrong: ${error}` });
    }
  }

  @Post('signin')
  async signIn(req: Request, resp: Response) {
    const { email, password } = req.body;
    try {
      const user = await this.userService.getByEmail(email);

      if (!user) {
        resp.status(HttpStatus.BAD_REQUEST).json({ message: `This email: ${email} does not exist in our database` });
        return;
      }

      const validated = await bcrypt.compare(password ?? '', user.password);

      if (!validated) {
        resp.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid password' });
        return;
      }

      const accessTokenCreated = accessToken({ ...user, password: undefined });
      const refreshTokenCreated = refreshToken({ ...user, password: undefined });

      resp.status(HttpStatus.OK).json({
        user: {
          ...user,
          password: undefined,
        },
        accessToken: accessTokenCreated,
        refreshToken: refreshTokenCreated,
      });
    } catch (error) {
      resp.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: `somthing went wrong: ${error}` });
    }
  }

  @Post('token')
  async createToken(req: Request, resp: Response) {
    const { token } = req.body;
    if (!token) {
      resp.status(HttpStatus.UNAUTHORIZED).json({ message: 'no token found' });
      return;
    }
    try {
      const { REFRESH_SECRET_TOKEN } = process.env;
      jwt.verify(token, REFRESH_SECRET_TOKEN, async (error: any, user: any) => {
        if (error) {
          resp.status(HttpStatus.FORBIDDEN).json({ message: 'Refresh token is expired' });
          return;
        }

        const accessTokenCreated = accessToken({ id: user.id, email: user.email });

        resp.status(HttpStatus.CREATED).json({ accessToken: accessTokenCreated });
      });
    } catch (error) {
      resp.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: `somthing went wrong ${error}` });
    }
  }

  @Post('reset')
  @Middleware([sendTokenLimiter, resetPasswordLimiter])
  async reset(req: Request, resp: Response) {
    const { email } = req.body;
    try {
      const user = await this.userService.getByEmail(email);

      if (!user) {
        resp.status(HttpStatus.NOT_FOUND).json({ message: `This email: ${email} does not exist in our database` });
        return;
      }

      const emailTokenCreated = emailToken({ id: user.id, email: user.email });
      sendMailResetPsw(emailTokenCreated, email);

      resp.status(HttpStatus.OK).json({ message: `We sent you an email to ${email}` });
    } catch (error) {
      resp.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: `somthing went wrong: ${error}` });
    }
  }

  @Put('update-password')
  @Middleware([changePasswordLimiter])
  async updatePassword(req: Request, resp: Response) {
    const { token, userPassword } = req.body;

    if (!token) {
      resp.status(HttpStatus.UNAUTHORIZED).json('No token found');
      return;
    }

    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPass = await bcrypt.hash(userPassword, salt);
      const { EMAIL_SECRET_TOKEN } = process.env;
      jwt.verify(token, EMAIL_SECRET_TOKEN, async (error: any, decoded: any) => {
        if (error) {
          resp.status(HttpStatus.FORBIDDEN).json({ message: 'Access token is expired' });

          return;
        }

        const user = await this.userService.getUser(decoded.id);
        const isConflict = await bcrypt.compare(userPassword, user.password);

        if (isConflict) {
          resp.status(HttpStatus.CONFLICT).json({ message: 'Can not use the same password as previous' });
          return;
        }

        const payload = {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          password: hashedPass,
          isVerified: true,
          role: Role.User,
        };

        await this.userService.updateUser(decoded.id, payload);
        const accessTokenCreated = accessToken({ ...user, password: undefined });
        const refreshTokenCreated = refreshToken({ ...user, password: undefined });
        const { password, ...others } = payload;

        resp
          .status(HttpStatus.OK)
          .json({ ...others, accessToken: accessTokenCreated, refreshToken: refreshTokenCreated });
      });
    } catch (error) {
      resp.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: `somthing went wrong: ${error}` });
    }
  }

  @Get('authorize/:token')
  async authorize(req: Request, resp: Response) {
    const { token } = req.params;

    if (!token) {
      resp.status(HttpStatus.UNAUTHORIZED).json({ message: 'no token found' });
      return;
    }

    const { EMAIL_SECRET_TOKEN } = process.env;

    try {
      jwt.verify(token, EMAIL_SECRET_TOKEN, async (error: any, decoded: any) => {
        if (error) {
          resp.status(HttpStatus.FORBIDDEN).json('Token is expired');
          return;
        }

        const user = await this.userService.getUser(decoded.id);

        if (user.isVerified) {
          resp.status(HttpStatus.REQUEST_TIMEOUT).json('Token was already used');
          return;
        }

        const payload: any = {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          password: user.password,
          isVerified: true,
          role: Role.User,
        };

        await this.userService.updateUser(decoded.id, payload);

        const accessTokenCreated = accessToken({ ...user, password: undefined });
        const refreshTokenCreated = refreshToken({ ...user, password: undefined });
        const { password, ...others } = payload;

        resp
          .status(HttpStatus.OK)
          .json({ ...others, accessToken: accessTokenCreated, refreshToken: refreshTokenCreated });
      });
    } catch (error) {
      resp.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: `somthing went wrong: ${error}` });
    }
  }
}
