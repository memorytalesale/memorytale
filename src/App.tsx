// src/App.tsx - Versión corregida completa
import React, { useState } from 'react';
import TaleChatbot from './components/TaleChatbot.tsx';
import '../css/chatbot.css';
import './App.css';

function App() {
  const [chatbotOpen, setChatbotOpen] = useState(false);

  return (
    <div className="App">
      {/* Botón flotante con colores corporativos MemoryTale */}
      <button 
        onClick={() => setChatbotOpen(true)}
        style={{
          position: 'fixed',
          bottom: '25px',
          right: '25px',
          background: 'linear-gradient(135deg, #5e3b4d 0%, #3e1b2d 100%)',
          color: 'white',
          border: 'none',
          padding: '16px 24px',
          fontSize: '15px',
          fontWeight: '600',
          borderRadius: '30px',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 8px 32px rgba(94, 59, 77, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          fontFamily: "'Quicksand', -apple-system, BlinkMacSystemFont, sans-serif",
          letterSpacing: '0.5px',
          minWidth: '160px',
          backdropFilter: 'blur(10px)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(94, 59, 77, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(94, 59, 77, 0.3)';
        }}
        aria-label="Abrir chat con Tale, tu asistente personal"
      >
        <span style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '8px' 
        }}>
          <span style={{ fontSize: '16px' }}>💬</span>
          Hablar con Tale
        </span>
      </button>

      {/* Modal del Chatbot - Posición esquina inferior derecha */}
      {chatbotOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          zIndex: 10000,
          backdropFilter: 'blur(8px)',
          padding: '20px'
        }}>
          <TaleChatbot 
            isModal={true}
            onClose={() => setChatbotOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

export default App;
