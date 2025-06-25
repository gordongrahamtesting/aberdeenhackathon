import React from 'react';
// For React 18+:
import ReactDOM from 'react-dom/client';
import App from './App'; // Import your main App component
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Root element with id 'root' not found");
}
const root = ReactDOM.createRoot(rootElement);

// Render your App component into the root
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// For React 17 or below, use the following instead:
// import ReactDOM from 'react-dom';
// import App from './App';
// import './index.css';
// ReactDOM.render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>,
//   document.getElementById('root')
// );
