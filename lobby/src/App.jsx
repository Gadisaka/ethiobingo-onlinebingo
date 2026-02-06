import { useState } from 'react'
import './App.css'
import logo from './ethiobingo.jpg'




function App() {

 const ADMIN_LINK = "https://ethiobingo.vercel.app/"

 const MOBILE_LINK = "https://play-ethiobingo.vercel.app/"

  return (
    <div className="lobby-container">
      {/* Ambient Background */}
      <div className="ambient-glow"></div>

      {/* Top Left Cashier Button */}
      <button className="cashier-btn" onClick={() => window.open(ADMIN_LINK, '_blank')}>
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

        <button className="play-btn" onClick={() => window.open(MOBILE_LINK, '_blank')}>
          Play
        </button>
      </div>
    </div>
  )
}

export default App
