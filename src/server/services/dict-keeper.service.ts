export class DictKeeperService<TSchema extends GenericSchemaReader> {
  constructor(
    private readonly transaction: Pick<IdbTransactionUtil, 'getCurrent'>,
    private readonly schema: TSchema,
  ) {}
}
