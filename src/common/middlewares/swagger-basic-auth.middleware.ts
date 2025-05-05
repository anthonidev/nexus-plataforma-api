import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { envs } from 'src/config/envs';

@Injectable()
export class SwaggerBasicAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {

    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      res.setHeader('WWW-Authenticate', 'Basic');
      throw new UnauthorizedException('Authorization header is missing');
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    const validUsername = envs.swaggerUsername || 'admin';
    const validPassword = envs.swaggerPassword || 'password123';

    if (username !== validUsername || password !== validPassword) {
      res.setHeader('WWW-Authenticate', 'Basic');
      throw new UnauthorizedException('Invalid credentials');
    }

    next();
  }
}