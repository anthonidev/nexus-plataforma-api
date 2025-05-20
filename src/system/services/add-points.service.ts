import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PointsTransaction, PointTransactionStatus, PointTransactionType } from 'src/points/entities/points_transactions.entity';
import { UserPoints } from 'src/points/entities/user_points.entity';
import { User } from 'src/user/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { AddPointsDto } from '../dto/add-points.dto';
import { NotificationFactory } from 'src/notifications/factory/notification.factory';

@Injectable()
export class AddPointsService {
    private readonly logger = new Logger(AddPointsService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(UserPoints)
        private readonly userPointsRepository: Repository<UserPoints>,
        @InjectRepository(PointsTransaction)
        private readonly pointsTransactionRepository: Repository<PointsTransaction>,
        private readonly dataSource: DataSource,
        private readonly notificationFactory: NotificationFactory,
    ) { }

    async addPoints(addPointsDto: AddPointsDto): Promise<any> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const user = await this.userRepository.findOne({
                where: { email: addPointsDto.email.toLowerCase().trim() },
                relations: ['personalInfo'],
            });

            if (!user) {
                throw new NotFoundException(`Usuario con email ${addPointsDto.email} no encontrado`);
            }

            // Create transaction record
            const pointsTransaction = this.pointsTransactionRepository.create({
                user: { id: user.id },
                type: PointTransactionType.DIRECT_BONUS,
                amount: addPointsDto.amount,
                status: PointTransactionStatus.COMPLETED,
                metadata: {
                    "Razón": addPointsDto.reason,
                    "Tipo de transacción": PointTransactionType.DIRECT_BONUS,
                    "Monto": addPointsDto.amount,
                },
            });

            await queryRunner.manager.save(pointsTransaction);

            // Update or create user points record
            let userPoints = await this.userPointsRepository.findOne({
                where: { user: { id: user.id } },
            });

            if (userPoints) {
                userPoints.availablePoints = Number(userPoints.availablePoints) + Number(addPointsDto.amount);
                userPoints.totalEarnedPoints = Number(userPoints.totalEarnedPoints) + Number(addPointsDto.amount);
                await queryRunner.manager.save(userPoints);
            } else {
                // Create new user points record if it doesn't exist
                const newUserPoints = this.userPointsRepository.create({
                    user: { id: user.id },
                    availablePoints: addPointsDto.amount,
                    totalEarnedPoints: addPointsDto.amount,
                    totalWithdrawnPoints: 0,
                });
                await queryRunner.manager.save(newUserPoints);
            }

            // Send notification to user
            try {
                await this.notificationFactory.directBonus(
                    user.id,
                    addPointsDto.amount,
                    'Administrador',
                    null,
                );
            } catch (notificationError) {
                this.logger.error(
                    `Error al enviar notificación: ${notificationError.message}`,
                    notificationError.stack,
                );
            }

            await queryRunner.commitTransaction();

            return {
                success: true,
                message: `Se han agregado ${addPointsDto.amount} puntos al usuario ${user.personalInfo?.firstName} ${user.personalInfo?.lastName} (${user.email}) correctamente.`,
                data: {
                    userId: user.id,
                    email: user.email,
                    addedPoints: addPointsDto.amount,
                    reason: addPointsDto.reason,
                    transactionId: pointsTransaction.id,
                },
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error al agregar puntos: ${error.message}`, error.stack);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
}