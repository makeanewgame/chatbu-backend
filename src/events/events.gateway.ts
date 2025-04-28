import { Inject } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { cli } from 'winston/lib/winston/config';



@WebSocketGateway(3002, { namespace: 'events', cors: true })
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      await this.cacheManager.set(`user_socket:${userId}`, client.id, 0); // TTL: sonsuz
      client.emit('message', { msg: 'connecting chatbu...' });
      // console.log(`User ${userId} connected with socket ${client.id}`);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    // console.log(`User ${userId} disconnected from socket ${client.id}`);
    if (userId) {
      await this.cacheManager.del(`user_socket:${userId}`);
    }
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    console.log('ping', client.handshake.query.userId);
    client.emit('message', { msg: 'pong' });
  }

  // Storage listener tarafından çağrılır
  async notifyUser(userId: string, payload: any) {
    const socketId = await this.cacheManager.get<string>(`user_socket:${userId}`);
    if (socketId) {
      this.server.to(socketId).emit('message', payload);
    }
  }
}
