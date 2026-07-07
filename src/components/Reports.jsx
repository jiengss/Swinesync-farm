import { Line, Radar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale, Title, Tooltip, Legend);

export default function Reports() {
  const fcrData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [{ label: 'FCR', data: [3.4, 3.3, 3.2, 3.1, 3.0], borderColor: '#f97316', fill: false }]
  };
  const complianceData = {
    labels: ['Vaccinations', 'Treatments', 'Checkups'],
    datasets: [{ label: 'Completion %', data: [98, 85, 92], backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981' }]
  };

  return (
    <div className="card">
      <h3 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}><i className="fas fa-chart-line"></i> Advanced Analytics</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div><Line data={fcrData} height={200} /></div>
        <div><Radar data={complianceData} height={200} /></div>
      </div>
      <div style={{ marginTop: 24, padding: 16, background: '#f3f4f6', borderRadius: 16 }}>
        <i className="fas fa-file-export"></i> <strong>Exportable Reports:</strong> Breeding success 84% • Feed Conversion 3.2 • Health compliance 96%
      </div>
      <button className="btn-primary" style={{ marginTop: 16 }}><i className="fas fa-download"></i> Download Summary (PDF)</button>
    </div>
  );
}