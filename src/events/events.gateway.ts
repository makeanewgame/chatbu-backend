import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { cli } from 'winston/lib/winston/config';
@WebSocketGateway(3002, { namespace: 'events' })
export class EventsGateway {


  @WebSocketServer()
  server: Server;

  @SubscribeMessage('message')
  handleMessage(client: any, payload: any): string {
    console.log('Received message:', payload);
    return 'Hello world!';
  }

  sendMessage() {
    this.server.emit('message', { message: 'Hello from server!' });
    console.log('Message sent to all clients');
  }
}
