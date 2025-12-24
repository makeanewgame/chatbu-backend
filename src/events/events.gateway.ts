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
    const teamId = client.handshake.query.teamId as string;
    if (teamId) {
      await this.cacheManager.set(`user_socket:${teamId}`, client.id, 0); // TTL: sonsuz
      client.emit('message', { msg: 'connecting chatbu...' });
      // console.log(`User ${userId} connected with socket ${client.id}`);
    }
  }

  async handleDisconnect(client: Socket) {
    const teamId = client.handshake.query.teamId as string;
    // console.log(`User ${userId} disconnected from socket ${client.id}`);
    if (teamId) {
      await this.cacheManager.del(`user_socket:${teamId}`);
    }
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    client.emit('message', { msg: 'pong' });
  }

  // Storage listener tarafından çağrılır
  async notifyUser(teamId: string, payload: any) {
    const socketId = await this.cacheManager.get<string>(`user_socket:${teamId}`);
    if (socketId) {
      this.server.to(socketId).emit('message', payload);
    }
  }
}
