import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';



@WebSocketGateway(3002, { path: '/events', cors: true })
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    const teamId = client.handshake.query.teamId as string;
    if (teamId) {
      client.join(teamId);
      client.emit('message', { msg: 'connecting chatbu...' });
    }
  }

  async handleDisconnect(_client: Socket) {
    // socket.io removes the client from all rooms automatically on disconnect
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    client.emit('message', { msg: 'pong' });
  }

  // Storage listener tarafından çağrılır
  async notifyUser(teamId: string, payload: any) {
    this.server.to(teamId).emit('message', payload);
  }
}
