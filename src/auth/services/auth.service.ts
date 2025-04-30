import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { compare } from 'bcryptjs';
import { envs } from 'src/config/envs';
import { MailService } from 'src/mail/mail.service';
import {
  Membership,
  MembershipStatus,
} from 'src/memberships/entities/membership.entity';
import { NotificationFactory } from 'src/notifications/factory/notification.factory';
import { RegisterDto } from 'src/user/dto/create-user.dto';
import { ContactInfo } from 'src/user/entities/contact-info.entity';
import { PersonalInfo } from 'src/user/entities/personal-info.entity';
import { Role } from 'src/user/entities/roles.entity';
import { Ubigeo } from 'src/user/entities/ubigeo.entity';
import { User } from 'src/user/entities/user.entity';
import { View } from 'src/user/entities/view.entity';
import { UserService } from 'src/user/services/user.service';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
export interface CleanView {
  id: number;
  code: string;
  name: string;
  icon?: string | null;
  url?: string | null;
  order: number;
  metadata?: any | null;
  children: CleanView[];
}

export interface MembershipInfo {
  hasMembership: boolean;
  plan?: {
    id: number;
    name: string;
  };
  status?: string;
}
@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    @InjectRepository(View)
    private viewRepository: Repository<View>,
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Ubigeo)
    private readonly ubigeoRepository: Repository<Ubigeo>,
    @InjectRepository(Membership)
    private membershipRepository: Repository<Membership>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly mailService: MailService,
    private readonly notificationFactory: NotificationFactory,
  ) { }
  private cleanView(view: View): CleanView {
    const {
      id,
      code,
      name,
      icon,
      url,
      order,
      metadata,
      children: rawChildren,
    } = view;
    const children =
      rawChildren
        ?.filter((child) => child.isActive)
        .map((child) => this.cleanView(child))
        .sort((a, b) => (a.order || 0) - (b.order || 0)) || [];
    return {
      id,
      code,
      name,
      icon,
      url,
      order: order || 0,
      metadata,
      children,
    };
  }

  private async buildViewTree(views: View[]): Promise<CleanView[]> {
    const parentViews = views
      .filter((view) => !view.parent && view.isActive)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    return parentViews.map((view) => this.cleanView(view));
  }

  private async getUserMembershipInfo(userId: string): Promise<MembershipInfo> {
    const membership = await this.membershipRepository.findOne({
      where: {
        user: { id: userId },
        status: MembershipStatus.ACTIVE,
      },
      relations: ['plan'],
    });

    if (!membership) {
      return { hasMembership: false };
    }

    return {
      hasMembership: true,
      plan: {
        id: membership.plan.id,
        name: membership.plan.name,
      },
      status: membership.status,
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await compare(password, user.password))) {
      if (!user.role.isActive) {
        throw new UnauthorizedException('El rol asociado está inactivo');
      }
      const { password, ...result } = user;
      return result;
    }
    return null;
  }
  async login(user: any) {
    const userWithRole = await this.usersService.findOne(user.id);
    if (!userWithRole.role.isActive) {
      throw new UnauthorizedException('El rol asociado está inactivo');
    }

    const membershipInfo = await this.getUserMembershipInfo(user.id);

    const roleViews = await this.viewRepository
      .createQueryBuilder('view')
      .leftJoinAndSelect('view.parent', 'parent')
      .leftJoinAndSelect('view.children', 'children')
      .leftJoin('view.roles', 'role')
      .where('role.id = :roleId', { roleId: userWithRole.role.id })
      .getMany();

    const viewTree = await this.buildViewTree(roleViews);

    const cleanRole = {
      id: userWithRole.role.id,
      code: userWithRole.role.code,
      name: userWithRole.role.name,
    };

    const payload = {
      email: user.email,
      sub: user.id,
      role: cleanRole,
      membership: membershipInfo.hasMembership
        ? {
          planId: membershipInfo.plan.id,
          planName: membershipInfo.plan.name,
        }
        : null,
    };

    // Fetch user's personal info to get firstName and lastName
    const userWithPersonalInfo = await this.userRepository.findOne({
      where: { id: user.id },
      relations: ['personalInfo'],
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        photo: user.photo,
        nickname: user.nickname,
        firstName: userWithPersonalInfo?.personalInfo?.firstName,
        lastName: userWithPersonalInfo?.personalInfo?.lastName,
        role: cleanRole,
        views: viewTree,
        membership: membershipInfo,
      },
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: envs.jwtRefreshSecret,
        expiresIn: '7d',
      }),
    };
  }
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: envs.jwtRefreshSecret,
      });
      const user = await this.usersService.findOne(payload.sub);
      if (!user || !user.isActive || !user.role.isActive) {
        throw new UnauthorizedException();
      }
      return this.login(user);
    } catch {
      throw new UnauthorizedException();
    }
  }

  async register(registerDto: RegisterDto) {
    const referralCode = this.generateReferralCode();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingUser = await this.userRepository.findOne({
        where: { email: registerDto.email.toLowerCase() },
      });

      if (existingUser) {
        throw new ConflictException('El correo electrónico ya está registrado');
      }

      const role = await this.roleRepository.findOne({
        where: { code: registerDto.roleCode, isActive: true },
      });

      if (!role) {
        throw new NotFoundException(
          `No se encontró el rol con ID ${registerDto.roleCode}`,
        );
      }

      const ubigeo = await this.ubigeoRepository.findOne({
        where: { id: registerDto.ubigeo.id },
      });

      if (!ubigeo) {
        throw new NotFoundException(
          `No se encontró el ubigeo con ID ${registerDto.ubigeo.id}`,
        );
      }

      const user = new User();
      user.email = registerDto.email;
      user.password = await this.hashPassword(registerDto.password);
      user.referralCode = referralCode;
      user.role = role;
      user.position = registerDto.position;

      if (registerDto.referrerCode) {
        const referrer = await this.userRepository.findOne({
          where: { referralCode: registerDto.referrerCode },
          relations: ['leftChild', 'rightChild'],
        });

        if (!referrer) {
          throw new NotFoundException(
            `No se encontró un usuario con el código de referido ${registerDto.referrerCode}`,
          );
        }
        const position = registerDto.position || 'LEFT';
        await this.findAvailablePosition(referrer, position, user);
        user.referrerCode = registerDto.referrerCode;
      }

      const savedUser = await queryRunner.manager.save(user);

      if (user.parent && user.position) {
        const referrer = user.parent;
        if (user.position === 'LEFT') {
          referrer.leftChild = savedUser;
        } else if (user.position === 'RIGHT') {
          referrer.rightChild = savedUser;
        }
        await queryRunner.manager.save(referrer);
      }

      const personalInfo = new PersonalInfo();
      personalInfo.firstName = registerDto.firstName;
      personalInfo.lastName = registerDto.lastName;
      personalInfo.gender = registerDto.gender;
      personalInfo.birthDate = new Date(registerDto.birthDate);
      personalInfo.user = savedUser;
      await queryRunner.manager.save(personalInfo);

      const contactInfo = new ContactInfo();
      contactInfo.phone = registerDto.phone;
      contactInfo.ubigeo = ubigeo;
      contactInfo.user = savedUser;
      await queryRunner.manager.save(contactInfo);

      await queryRunner.commitTransaction();

      const payload = {
        email: savedUser.email,
        sub: savedUser.id,
        role: {
          id: role.id,
          code: role.code,
          name: role.name,
        },
      };
      await this.sendWelcomeEmail(
        savedUser.email,
        personalInfo.firstName,
        personalInfo.lastName,
      );

      // Agregar notificación si hay un referidor
      if (registerDto.referrerCode) {
        const referrer = await this.userRepository.findOne({
          where: { referralCode: registerDto.referrerCode },
        });

        if (referrer) {
          // Enviar notificación al referidor
          await this.notificationFactory.referralRegistered(
            referrer.id,
            `${personalInfo.firstName} ${personalInfo.lastName}`,
            savedUser.id
          );
        }
      }

      return {
        user: {
          id: savedUser.id,
          email: savedUser.email,
          referralCode: savedUser.referralCode,
          firstName: personalInfo.firstName,
          lastName: personalInfo.lastName,
        },
        accessToken: this.jwtService.sign(payload),
        refreshToken: this.jwtService.sign(payload, {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: '7d',
        }),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Error al registrar el usuario');
    } finally {
      await queryRunner.release();
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }
  private async findAvailablePosition(
    parent: User,
    preferredPosition: 'LEFT' | 'RIGHT',
    user: User,
  ): Promise<void> {
    if (preferredPosition === 'LEFT') {
      if (!parent.leftChild) {
        user.parent = parent;
        user.position = 'LEFT';
        return;
      } else {
        const leftChild = await this.userRepository.findOne({
          where: { id: parent.leftChild.id },
          relations: ['leftChild', 'rightChild'],
        });
        await this.findAvailablePosition(leftChild, preferredPosition, user);
      }
    } else {
      // RIGHT
      if (!parent.rightChild) {
        user.parent = parent;
        user.position = 'RIGHT';
        return;
      } else {
        const rightChild = await this.userRepository.findOne({
          where: { id: parent.rightChild.id },
          relations: ['leftChild', 'rightChild'],
        });
        await this.findAvailablePosition(rightChild, preferredPosition, user);
      }
    }
  }
  private generateReferralCode(): string {
    return uuidv4().substring(0, 8).toUpperCase();
  }
  private async sendWelcomeEmail(
    email: string,
    firstName: string,
    lastName: string,
  ) {
    await this.mailService.sendMail({
      to: email,
      subject: '¡Bienvenido a Nexus Platform!',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
          <div style="background-color: #0a8043; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">¡Bienvenido a Nexus Platform!</h1>
          </div>
          
          <div style="padding: 20px; background-color: #fff; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; line-height: 1.6;">Hola <strong>${firstName} ${lastName}</strong>,</p>
            
            <p style="font-size: 16px; line-height: 1.6;">¡Gracias por unirte a nuestra plataforma! Estamos muy contentos de tenerte como miembro de nuestra comunidad.</p>
            
            <p style="font-size: 16px; line-height: 1.6;">Con tu cuenta de Nexus Platform podrás:</p>
            
            <ul style="font-size: 16px; line-height: 1.6;">
              <li>Acceder a planes de membresía exclusivos</li>
              <li>Construir tu red de referidos</li>
              <li>Obtener beneficios y comisiones</li>
              <li>Seguir tu progreso en tiempo real</li>
            </ul>
            
            <p style="font-size: 16px; line-height: 1.6;">Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.</p>
            
            <div style="margin-top: 40px; text-align: center;">
              <a href="${envs.frontendUrl}/login" style="background-color: #0a8043; color: white; text-decoration: none; padding: 12px 25px; border-radius: 4px; font-weight: bold;">Ingresar a mi cuenta</a>
            </div>
            
            <p style="margin-top: 40px; font-size: 16px; line-height: 1.6;">¡Te deseamos mucho éxito!</p>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Saludos,<br>
              El equipo de Nexus Platform
            </p>
          </div>
          
          <div style="text-align: center; padding-top: 20px; font-size: 12px; color: #888;">
            <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
          </div>
        </div>
      `,
    });
  }
}
