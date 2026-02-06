import { useState } from 'react'
import './App.css'
import logo from './ethiobingo.jpg'

function App() {
  return (
    <div className="lobby-container">
      {/* Ambient Background */}
      <div className="ambient-glow"></div>

      {/* Top Left Cashier Button */}
      <button className="cashier-btn">
        <span className="icon">💰</span> Cashier
      </button>

      {/* Center Content */}
      <div className="center-content">
        <div className="logo-section">
          <div className="logo-circle">
            <img src={logo} alt="Ethio Bingo Logo" className="logo-img" />
          </div>
          <h1 className="logo-text">Ethio Bingo</h1>
        </div>

        <button className="play-btn">
          Play
        </button>
      </div>
    </div>
  )
}

export default App
