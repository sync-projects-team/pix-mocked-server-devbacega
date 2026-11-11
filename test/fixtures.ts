import { randomUUID } from 'crypto';
import { gerarCPF } from '../src/libs/documentos';
import { flatDate } from '../src/libs/utils';
import {
  PeriodicidadeRecorrencia,
  PoliticaRetentativa,
  RecPostRequest,
} from '../src/core/app/models/rec';

export const newTxid = () => randomUUID().replace(/-/g, '');

export const buildRec = (
  politicaRetentativa = PoliticaRetentativa.NaoPermite,
  cpf = gerarCPF(),
): RecPostRequest => ({
  vinculo: {
    objeto: 'Pagamento de assinatura',
    contrato: newTxid(),
    devedor: {
      cep: '26083190',
      cidade: 'Nova Iguaçu',
      logradouro: 'Rua Gemeos',
      uf: 'RJ',
      nome: 'Devedor da Silva',
      cpf,
    },
  },
  ativacao: { dadosJornada: { txid: newTxid() } },
  calendario: {
    dataInicial: flatDate(new Date()).toJSON(),
    periodicidade: PeriodicidadeRecorrencia.Mensal,
  },
  politicaRetentativa,
  recebedor: {
    cep: '26083190',
    cidade: 'Nova Iguaçu',
    logradouro: 'Rua Gemeos',
    uf: 'RJ',
    nome: 'Recebedor LTDA',
    cpf: gerarCPF(),
  },
  valor: { valorRec: '100.00' },
});
