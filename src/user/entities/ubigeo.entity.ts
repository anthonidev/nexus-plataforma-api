import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
@Entity('ubigeos')
export class Ubigeo {
  @PrimaryGeneratedColumn('increment')
  id: number;
  @Column('text', {
    nullable: false,
  })
  name: string;
  @Column('text', {
    nullable: false,
    unique: true,
  })
  code: string;
  @Column('int', {
    nullable: true,
  })
  parentId: number;
  @OneToMany(() => Ubigeo, (ubigeo) => ubigeo.parent)
  children: Ubigeo[];
  @ManyToOne(() => Ubigeo, (ubigeo) => ubigeo.children, { nullable: true })
  parent: Ubigeo;
}
