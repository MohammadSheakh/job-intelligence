import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module.js';
import { AdminCandidatesController } from './controllers/admin-candidates.controller.js';
import { AdminCandidatesService } from './services/admin-candidates.service.js';

@Module({
  imports: [AuthenticationModule],
  controllers: [AdminCandidatesController],
  providers: [AdminCandidatesService],
})
export class AdminOperationsModule {}
