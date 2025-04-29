import { CanActivate, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
    constructor(private jwtService: JwtService) { }

    async canActivate(context: any): Promise<boolean> {
        const client: Socket = context.switchToWs().getClient();
        const token = client.handshake.auth.token;

        if (!token) {
            throw new WsException('Token de autenticación no proporcionado');
        }

        try {
            const payload = this.jwtService.verify(token);
            client.data.user = payload;
            return true;
        } catch (err) {
            throw new WsException('Token de autenticación inválido');
        }
    }
}