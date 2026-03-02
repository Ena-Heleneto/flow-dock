export const PageSchema = defineSchemaHandler(
  {
    name: 'pages',
    options: { keyPath: 'id' },
    indexes: [
      { name: 'routeSig', keyPath: 'routeSig' },
      { name: 'clusterId', keyPath: 'clusterId' },
      { name: 'system', keyPath: 'system' },
      { name: 'pageType', keyPath: 'pageType' },
      { name: 'ts', keyPath: 'ts' },
    ],
  },
)
