import { injectable } from 'tsyringe';
import { DataSource, Equal, Repository } from 'typeorm';
import { CustomExternalError } from '../../core/domain/error/custom.external.error';
import { ErrorCode } from '../../core/domain/error/error.code';
import { HttpStatus } from '../../core/lib/http-status';
import axios from 'axios';
import { validation } from '../../core/lib/validator';
import { Foryou } from '../../core/entities';

@injectable()
export class ForyouService {
  private foryouRepository: Repository<Foryou>;
  constructor(dataSource: DataSource) {
    this.foryouRepository = dataSource.getRepository(Foryou);
  }

  async getForyous() {
    const foryous = await this.foryouRepository.find();
    return foryous;
  }

  async getForyou(id: string) {
    const foryou = await this.foryouRepository.findOne({
      where: {
        userId: Equal(id),
      },
    });
    return foryou;
  }

  async createForyou(newForyou: Foryou): Promise<Foryou> {
    return this.foryouRepository.save(newForyou);
  }

  async updateForyou(id: string, foryouDTO: Foryou) {
    const foryou = await this.foryouRepository.findOneOrFail({
      where: {
        userId: Equal(id),
      },
    });
    const newForyou = {
      ...foryou,
      ...foryouDTO,
    };
    return this.foryouRepository.save(newForyou);
  }

  async removeForyou(id: string) {
    const foryou = await this.foryouRepository.findOneOrFail({
      where: {
        userId: Equal(id),
      },
    });
    return this.foryouRepository.remove(foryou);
  }
}