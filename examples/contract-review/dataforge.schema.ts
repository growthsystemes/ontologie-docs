import {
  objectType,
  string,
  number,
  date,
  enumType,
  link,
  action,
  role,
  now,
  compile,
} from '@dataforge/schema';

// --- Enums ---

const ContractStatus = enumType('ContractStatus', [
  'draft',
  'pending_review',
  'approved',
  'rejected',
]);

// --- Object Types ---

const Client = objectType('Client', {
  name: string().required().indexed(),
  email: string().optional(),
  sector: string().optional(),
});

const Contract = objectType('Contract', {
  reference: string().required().indexed(),
  title: string().required(),
  amount: number(),
  currency: string().default('EUR'),
  status: ContractStatus.default('draft')
    .mutableBy(['Contract.submit', 'Contract.approve', 'Contract.reject']),
  submittedAt: date().optional()
    .mutableBy(['Contract.submit']),
  approvedAt: date().optional()
    .mutableBy(['Contract.approve']),
  rejectedAt: date().optional()
    .mutableBy(['Contract.reject']),
  rejectionReason: string().optional()
    .mutableBy(['Contract.reject']),
});

// --- Links ---

const ContractBelongsToClient = link('Contract', 'Client')
  .cardinality('many_to_one')
  .label('belongs_to');

// --- Actions ---

const submitContract = action('submit')
  .on(Contract)
  .executionMode('twin_apply')
  .riskLevel('low')
  .when(c => c.status.eq('draft'))
  .set({ status: 'pending_review', submittedAt: now() });

const approveContract = action('approve')
  .on(Contract)
  .executionMode('twin_apply')
  .riskLevel('medium')
  .input({ comment: string().optional() })
  .requires(role('manager'))
  .when(c => c.status.eq('pending_review'))
  .set({ status: 'approved', approvedAt: now() });

const rejectContract = action('reject')
  .on(Contract)
  .executionMode('twin_apply')
  .riskLevel('medium')
  .input({ reason: string().required() })
  .requires(role('manager'))
  .when(c => c.status.eq('pending_review'))
  .set((_c, input) => ({
    status: 'rejected',
    rejectedAt: now(),
    rejectionReason: input.reason,
  }));

// --- Manifest export ---

export const manifest = compile([Client, Contract], {
  actions: [submitContract, approveContract, rejectContract],
});
