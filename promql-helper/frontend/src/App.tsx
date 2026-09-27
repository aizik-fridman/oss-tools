import { Routes, Route, Navigate } from 'react-router-dom';
import PortalLayout from './components/PortalLayout';
import ExplainerTool from './tools/ExplainerTool';
import AlertAnalyzerTool from './tools/AlertAnalyzerTool';
import DashboardAnalyzerTool from './tools/DashboardAnalyzerTool';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PortalLayout />}>
        <Route index element={<Navigate to="/promql-helper" replace />} />
        <Route path="promql-helper" element={<ExplainerTool />} />
        <Route path="alert-analyzer" element={<AlertAnalyzerTool />} />
        <Route path="dashboard-analyzer" element={<DashboardAnalyzerTool />} />
      </Route>
    </Routes>
  );
}
