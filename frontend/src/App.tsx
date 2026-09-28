import { Routes, Route } from 'react-router-dom';
import PortalLayout from './components/layout/PortalLayout';
import ExplainerTool from './features/promql/Explainer';
import AlertAnalyzerTool from './features/alerts/AlertAnalyzer';
import DashboardAnalyzerTool from './features/dashboard/DashboardAnalyzer';
import SreCalculator from './features/sre/SreCalculator';
import LgtmConfigs from './features/configs/LgtmConfigs';

import HomePage from './features/home/HomePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PortalLayout />}>
        <Route index element={<HomePage />} />
        <Route path="promql-helper" element={<ExplainerTool />} />
        <Route path="alert-analyzer" element={<AlertAnalyzerTool />} />
        <Route path="dashboard-analyzer" element={<DashboardAnalyzerTool />} />
        <Route path="sre-calculator" element={<SreCalculator />} />
        <Route path="lgtm-configs" element={<LgtmConfigs />} />
      </Route>
    </Routes>
  );
}
