import React from 'react';
import ReactDOM from 'react-dom/client';

// Minimal test to verify React is working
function TestApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>React Test Render</h1>
      <p>If you see this, React is working correctly!</p>
      <p>React version: {React.version}</p>
      <p>Timestamp: {new Date().toISOString()}</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<TestApp />);
