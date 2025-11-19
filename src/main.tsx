import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { autoIncrementOnStart } from './utils/version'

// 앱 시작 시 버전 자동 증가 (하루에 한 번만)
autoIncrementOnStart()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

