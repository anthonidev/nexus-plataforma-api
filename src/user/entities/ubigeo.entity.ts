import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'ubigeo' })
export class Ubigeo {
  @PrimaryGeneratedColumn('increment')
  nIdUbigeo: number;

  @Column('text', {
    nullable: false,
  })
  sNombre: string;

  @Column('text', {
    nullable: false,
    unique: true,
  })
  sCodigo: string;

  @Column('int', {
    nullable: true,
  })
  nIdUbigeoPadre: number;

  @OneToMany(() => Ubigeo, (ubigeo) => ubigeo.padre)
  hijos: Ubigeo[];

  @ManyToOne(() => Ubigeo, (ubigeo) => ubigeo.hijos, { nullable: true })
  padre: Ubigeo;
}
