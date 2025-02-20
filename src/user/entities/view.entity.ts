import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from './roles.entity';

@Entity('views')
export class View {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true })
  url: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  backgroundColor: string;

  @Column({ nullable: true })
  textColor: string;

  @Column({ default: 0 })
  order: number;

  // Relación jerárquica
  @ManyToOne(() => View, (view) => view.children, { nullable: true })
  parent: View;

  @OneToMany(() => View, (view) => view.parent)
  children: View[];

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'role_views',
    joinColumn: {
      name: 'view_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
    },
  })
  roles: Role[];
}
