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

  // Ajan paneli: kendisine atanan chatlerdeki müşteri mesajlarını dinlemek için odaya katılır
  @SubscribeMessage('join-agent-room')
  async handleJoinAgentRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { userId: string }) {
    if (data?.userId) {
      client.join(`agent-${data.userId}`);
    }
  }

  // Müşteri widget'ı: ajan mesajlarını almak için chat odasına katılır
  @SubscribeMessage('join-chat-room')
  async handleJoinChatRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { chatId: string }) {
    if (data?.chatId) {
      client.join(`chat-${data.chatId}`);
    }
  }

  // Storage listener tarafından çağrılır
  async notifyUser(teamId: string, payload: any) {
    this.server.to(teamId).emit('message', payload);
  }

  // Ajana: müşteri yeni mesaj gönderdi
  async notifyAgent(agentUserId: string, payload: any) {
    this.server.to(`agent-${agentUserId}`).emit('new_customer_message', payload);
  }

  // Müşteri widget'ına: ajan yeni mesaj gönderdi
  async notifyCustomer(chatId: string, payload: any) {
    this.server.to(`chat-${chatId}`).emit('agent_message', payload);
  }
}
