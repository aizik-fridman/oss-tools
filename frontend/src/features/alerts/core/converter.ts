export function convertToUnified(prometheusRules: any) {
  if (!prometheusRules?.original) {
    return { groups: [] };
  }
  
  const folder = 'Imported Alerts';
  const datasourceUid = 'prometheus-default'; // Can be parameterized later

  // A helper to generate a short pseudo-random UID for Grafana
  const genUid = () => Math.random().toString(36).substring(2, 10);

  // We map every group from the original file
  const groups = (prometheusRules.original.groups || []).map((g: any) => {
    return {
      name: g.name || 'default-group',
      folder: folder,
      interval: g.interval || '1m',
      rules: (g.rules || []).filter((r: any) => r.alert).map((r: any) => {
        return {
          uid: genUid(),
          title: r.alert,
          condition: 'C',
          data: [
            {
              refId: 'A',
              queryType: '',
              relativeTimeRange: { from: 600, to: 0 },
              datasourceUid: datasourceUid,
              model: {
                expr: r.expr,
                refId: 'A',
                hide: false
              }
            },
            {
              refId: 'B',
              datasourceUid: '__expr__',
              model: {
                conditions: [
                  {
                    evaluator: { params: [], type: 'gt' },
                    operator: { type: 'and' },
                    query: { params: ['B'] },
                    reducer: { params: [], type: 'last' },
                    type: 'query'
                  }
                ],
                datasource: { type: '__expr__', uid: '__expr__' },
                expression: 'A',
                intervalMs: 1000,
                maxDataPoints: 43200,
                reducer: 'last',
                refId: 'B',
                type: 'reduce'
              }
            },
            {
              refId: 'C',
              datasourceUid: '__expr__',
              model: {
                conditions: [
                  {
                    evaluator: { params: [0], type: 'gt' },
                    operator: { type: 'and' },
                    query: { params: ['C'] },
                    reducer: { params: [], type: 'last' },
                    type: 'query'
                  }
                ],
                datasource: { type: '__expr__', uid: '__expr__' },
                expression: '$B > 0',
                intervalMs: 1000,
                maxDataPoints: 43200,
                refId: 'C',
                type: 'math'
              }
            }
          ],
          noDataState: 'NoData',
          execErrState: 'Error',
          for: r.for || '5m',
          annotations: r.annotations || {},
          labels: r.labels || {}
        };
      })
    };
  });

  return { groups };
}