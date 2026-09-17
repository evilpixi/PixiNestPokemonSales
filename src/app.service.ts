import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World! <a href=http://localhost:3000/app>http://localhost:3000/app<a>';
  }
}
