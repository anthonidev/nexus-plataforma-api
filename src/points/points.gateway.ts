// src/points/points.gateway.ts
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
    cors: true,
    namespace: '/points',
})
export class PointsGateway
    implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(PointsGateway.name);
    private userSockets: Map<string, string[]> = new Map();

    @WebSocketServer()
    server: Server;

    handleConnection(client: Socket) {
        const userId = client.handshake.query.userId as string;

        if (!userId) {
            this.logger.warn('Socket connection attempt without userId');
            client.disconnect();
            return;
        }

        this.logger.log(`Client connected: ${client.id} for user: ${userId}`);

        const userSocketIds = this.userSockets.get(userId) || [];
        userSocketIds.push(client.id);
        this.userSockets.set(userId, userSocketIds);

        client.join(`user-${userId}`);
    }

    handleDisconnect(client: Socket) {
        const userId = client.handshake.query.userId as string;

        if (userId) {
            const userSocketIds = this.userSockets.get(userId) || [];
            const updatedSocketIds = userSocketIds.filter(
                (socketId) => socketId !== client.id,
            );

            if (updatedSocketIds.length > 0) {
                this.userSockets.set(userId, updatedSocketIds);
            } else {
                this.userSockets.delete(userId);
            }
        }

        this.logger.log(`Client disconnected: ${client.id}`);
    }

    @OnEvent('points.updated')
    handlePointsUpdated(payload: { userId: string; points: any }) {
        const { userId, points } = payload;

        this.server.to(`user-${userId}`).emit('pointsUpdate', points);

        this.logger.log(`Points update sent to user ${userId}`);
    }
}