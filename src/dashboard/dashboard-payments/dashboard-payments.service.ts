import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RangeDatesDto } from 'src/common/dto/range-dates.dto';
import { getFinalDayMonth } from 'src/common/helpers/get-final-day-month.helper';
import { getInitialMonth } from 'src/common/helpers/get-initial-month.helper';
import { Payment } from 'src/payments/entities/payment.entity';
import { Repository } from 'typeorm';

@Injectable()
export class DashboardPaymentsService {
  private readonly logger = new Logger(DashboardPaymentsService.name);
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async getPaymentsByEntityType(
    rangeDatesDto: RangeDatesDto,
  ) {
    try {
      const {
        startDate = getInitialMonth(),
        endDate = getFinalDayMonth()
      } = rangeDatesDto;

      const paymentsData = await this.paymentRepository.query(`
        WITH DateSeries AS (
          SELECT generate_series(
            '${startDate}'::date,
            '${endDate}'::date,
            '1 day'::interval
          )::date AS dt
        )
        SELECT
          ds.dt AS fecha,
          p."relatedEntityType" AS entity_type,
          COALESCE(COUNT(p.id), 0) AS count
        FROM DateSeries ds
        LEFT JOIN payments p ON DATE(p."updatedAt") = ds.dt
        WHERE p.status = 'APPROVED'
        GROUP BY ds.dt, p."relatedEntityType"
        ORDER BY ds.dt ASC, p."relatedEntityType" ASC;
      `);

      const formattedData: { [date: string]: { date: string; membership?: number; membership_upgrade?: number; membership_reconsumption?: number; orders?: number } } = {};
      const allEntityTypes = ['membership', 'membership_upgrade', 'membership_reconsumption', 'orders'];

      // Inicializar formattedData con todas las fechas del rango y todos los entityTypes en 0
      let currentDate = new Date(startDate);
      const endDateObj = new Date(endDate);

      while (currentDate <= endDateObj) {
        const dateString = currentDate.toISOString().slice(0, 10);
        formattedData[dateString] = { date: dateString, ...Object.fromEntries(allEntityTypes.map(type => [type, 0])) };
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Llenar formattedData con los conteos reales de paymentsData
      paymentsData.forEach(item => {
        const date = (item.fecha as Date).toISOString().split('T')[0];
        const entityType = item.entity_type;
        const count = parseInt(item.count, 10);
        if (formattedData[date]) {
          formattedData[date][entityType] = count;
        }
      });

      const result = Object.values(formattedData);
      return result.map( item => ({
        date: item.date,
        membresia: item.membership,
        upgrade: item.membership_upgrade,
        reconsumo: item.membership_reconsumption,
        orden: item.orders,
      }));
    } catch (error) {
      this.logger.error(`Error obteniendo datos de pagos: ${error.message}`, error.stack);
      throw error;
    }
  }
  
}
