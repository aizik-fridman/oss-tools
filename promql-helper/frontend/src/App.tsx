import { Routes, Route, Navigate } from 'react-router-dom';
import PortalLayout from './components/PortalLayout';
import ExplainerTool from './tools/ExplainerTool';
import SelectorBuilderTool from './tools/SelectorBuilderTool';
import AlertAnalyzerTool from './tools/AlertAnalyzerTool';
import DashboardAnalyzerTool from './tools/DashboardAnalyzerTool';
import YamlConverterTool from './tools/YamlConverterTool';
import StepCalculatorTool from './tools/StepCalculatorTool';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PortalLayout />}>
        <Route index element={<Navigate to="/explainer" replace />} />
        <Route path="explainer" element={<ExplainerTool />} />
        <Route path="selector-builder" element={<SelectorBuilderTool />} />
        <Route path="alert-analyzer" element={<AlertAnalyzerTool />} />
        <Route path="dashboard-analyzer" element={<DashboardAnalyzerTool />} />
        <Route path="step-calculator" element={<StepCalculatorTool />} />
        <Route path="yaml-converter" element={<YamlConverterTool />} />
      </Route>
    </Routes>
  );
}
