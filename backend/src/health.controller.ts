import { Controller, Get } from '@nestjs/common';

// Endpoint công khai: dùng cho smoke test sau deploy để kiểm tra đúng version đã lên
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      env: process.env.APP_ENV ?? 'local',
      version: process.env.APP_VERSION ?? 'dev',
    };
  }
}
