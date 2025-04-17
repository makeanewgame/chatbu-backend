import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
@WebSocketGateway(3002, {})
export class EventsGateway {

  @SubscribeMessage('newuser')
  handleNewUser(client: Socket, payload: any): string {
    console.log('New user connected:', payload);
    return 'User added';
  }

  @SubscribeMessage('message')
  handleMessage(client: any, payload: any): string {
    console.log('Received message:', payload);
    return 'Hello world!';
  }
}
