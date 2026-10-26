import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import Start from './pages/Start.jsx'
import Home from './pages/Home.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Start />} />
        <Route path="/c/:code" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
