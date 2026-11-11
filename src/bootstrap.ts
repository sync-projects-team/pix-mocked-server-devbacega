import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { MemoryDB } from './libs/fakedb';
import { errorFormatter } from './libs/utils';
import { correntistas } from './data/db.json';

export const COLLECTIONS: Record<string, string[]> = {
  COB: ['txid'],
  COB_HIST: ['id'],
  LOCATIONS: ['id', 'uuid'],
  LOC_COB: ['id', 'txid'],
  REC: ['idRec'],
};

export async function setupDatabase(): Promise<void> {
  Object.entries(COLLECTIONS).forEach(([name, sortKeys]) =>
    MemoryDB.create(name, sortKeys),
  );

  const corr = MemoryDB.create('CORRENTISTAS', ['chave', 'cpfcnpj']);
  await Promise.all(correntistas.map((c) => corr.add('DEV', c)));
}

export const createValidationPipe = (): ValidationPipe =>
  new ValidationPipe({
    disableErrorMessages: false,
    transform: true,
    skipMissingProperties: true,
    exceptionFactory: (errors) => {
      throw new BadRequestException(errorFormatter(errors));
    },
  });
