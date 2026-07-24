import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Socket, Server } from 'socket.io';



@WebSocketGateway(3002, { path: '/events', cors: true })
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) { }

  // Verify the dashboard access token supplied in the socket handshake.
  // Returns the decoded auth payload, or null if missing/invalid.
  private authenticate(client: Socket): any | null {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string);
    if (!token) return null;
    try {
      const payload: any = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      return payload?.type === 'auth' ? payload : null;
    } catch {
      return null;
    }
  }

  async handleConnection(client: Socket) {
    const user = this.authenticate(client);
    (client.data as any).user = user;

    const teamId = client.handshake.query.teamId as string;
    if (teamId) {
      // Team rooms carry every team member's real-time messages. Only allow a
      // socket to join the team room it is actually authenticated for —
      // otherwise anyone who knows/guesses a teamId could eavesdrop.
      if (!user || user.teamId !== teamId) {
        client.emit('error', { msg: 'unauthorized' });
        client.disconnect(true);
        return;
      }
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
    const user = (client.data as any).user;
    if (!user) return;
    // An agent may only join their own room — never another user's.
    const authedUserId = user.sub || user.id;
    if (data?.userId && data.userId === authedUserId) {
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

  // Ajana: bir ziyaretçi canlı destek talep etti (dashboard'da toast/ses için,
  // sessiz new_customer_message'dan ayrı, dikkat çekici bir event)
  async notifyHandoffRequested(agentUserId: string, payload: any) {
    this.server.to(`agent-${agentUserId}`).emit('handoff_requested', payload);
  }

  // Müşteri widget'ına: ajan yeni mesaj gönderdi
  async notifyCustomer(chatId: string, payload: any) {
    this.server.to(`chat-${chatId}`).emit('agent_message', payload);
  }

  // Müşteri widget'ına: chat sona erdi (ajan kapattı / cron otomatik kapattı)
  async notifyChatEnded(chatId: string, payload: any) {
    this.server.to(`chat-${chatId}`).emit('chat_ended', payload);
  }
}
