import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

export default function Landing() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [role, setRole] = useState<'host' | 'guest'>('host')

  function createRoom() {
    const roomId = crypto.randomUUID().slice(0, 8)  // or any id you want
    nav(`/room/${roomId}?name=${encodeURIComponent(name)}&role=${role}`)
  }

  return (
    <div>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" />
      <select value={role} onChange={e=>setRole(e.target.value as any)}>
        <option value="host">Host</option>
        <option value="guest">Guest</option>
      </select>
      <button onClick={createRoom}>Create / Join</button>
    </div>
  )
}
