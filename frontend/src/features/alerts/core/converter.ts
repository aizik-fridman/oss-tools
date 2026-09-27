export function convertToUnified(legacyRules: any): any {
  if (!legacyRules) return null;
  const { original, rules } = legacyRules;
  
  let groupName = 'Converted_Alerts';
  let folder = 'Imported Alerts';
  
  if (original.groups && original.groups[0]) {
    groupName = original.groups[0].name || groupName;
  }
  
  const newRules = rules.map((r: any) => ({
    title: r.alert || 'Unnamed Alert',
    condition: 'A',
    data: [
      {
        refId: 'A',
        relativeTimeRange: { from: 600, to: 0 },
        datasourceUid: 'prometheus-default',
        model: {
          expr: r.expr,
          refId: 'A',
        }
      }
    ],
    noDataState: 'NoData',
    execErrState: 'Error',
    for: r.for || '5m',
    annotations: r.annotations || {},
    labels: r.labels || {},
    isPaused: false
  }));

  return {
    apiVersion: 1,
    groups: [
      {
        orgId: 1,
        name: groupName,
        folder: folder,
        interval: '1m',
        rules: newRules
      }
    ]
  };
}
