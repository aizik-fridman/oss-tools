import { Routes, Route, Navigate } from 'react-router-dom';
import PortalLayout from './components/PortalLayout';
import ExplainerTool from './tools/ExplainerTool';
import SelectorBuilderTool from './tools/SelectorBuilderTool';
import AlertGeneratorTool from './tools/AlertGeneratorTool';
import StepCalculatorTool from './tools/StepCalculatorTool';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PortalLayout />}>
        <Route index element={<Navigate to="/explainer" replace />} />
        <Route path="explainer" element={<ExplainerTool />} />
        <Route path="selector-builder" element={<SelectorBuilderTool />} />
        <Route path="alert-generator" element={<AlertGeneratorTool />} />
        <Route path="step-calculator" element={<StepCalculatorTool />} />
      </Route>
    </Routes>
  );
}
