import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { authApi } from '../../auth/authApi';
import {
  ArrowLeft, Save, MapPin, User, Shield, Bell, BookOpen, Plus, X, Loader,
} from 'lucide-react';

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json`,
    );
    const d = await r.json();
    const a = d.address || {};
    return {
      street: a.road || a.neighbourhood || '',
      city: a.city || a.town || a.village || '',
      state: a.state || '',
      pincode: a.postcode || '',
    };
  } catch { return null; }
}

function calcAge(dob) {
  if (!dob) return '';
  return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
}

function ListSection({ icon: Icon, title, items, onAdd, onRemove, placeholder }) {
  const [input, setInput] = useState('');
  const handleAdd = () => {
    const v = input.trim();
    if (v && !items.includes(v)) onAdd(v);
    setInput('');
  };
  return (
    <section className="card p-5">
      <div className="flex items-center gap-2 text-primary mb-2">
        <Icon size={18} /><h2 className="font-semibold text-base text-text-primary">{title}</h2>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1 mb-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary bg-surface-3 rounded-lg px-3 py-2" style={{ background: 'var(--color-surface-3)' }}>
              <span className="flex-1">{item}</span>
              <button type="button" onClick={() => onRemove(item)} className="text-text-hint hover:text-red-500 mt-0.5"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input className="input-field flex-1 text-sm" placeholder={placeholder} value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }} />
        <button type="button" onClick={handleAdd} className="btn-ghost px-3"><Plus size={20} /></button>
      </div>
    </section>
  );
}

export default function AdminProfile() {
  const navigate = useNavigate();
  const { user, accessToken, refreshProfile } = useAuth();

  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState('');

  const [gen, setGen] = useState({
    firstName: '', lastName: '', age: '', gender: '', phone: '',
    adminDistrict: '',
    coordinates: { lat: '', lng: '' },
    address: { street: '', city: '', state: '', pincode: '' },
  });
  const [govNotifications, setGovNotifications] = useState([]);
  const [govGuidelines, setGovGuidelines] = useState([]);

  useEffect(() => {
    if (!user) return;
    setGen({
      firstName: user.firstName || '', lastName: user.lastName || '',
      age: user.age ?? calcAge(user.dateOfBirth) ?? '',
      gender: user.gender || '', phone: user.phone || '',
      adminDistrict: user.adminDistrict || user.district || '',
      coordinates: { lat: user.coordinates?.lat ?? '', lng: user.coordinates?.lng ?? '' },
      address: { street: user.address?.street || '', city: user.address?.city || '', state: user.address?.state || '', pincode: user.address?.pincode || '' },
    });
    setGovNotifications(user.govNotifications || []);
    setGovGuidelines(user.govGuidelines || []);
  }, [user]);

  const handleLocate = async () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setGen(p => ({ ...p, coordinates: { lat: pos.coords.latitude, lng: pos.coords.longitude }, address: addr || p.address }));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true },
    );
  };

  const handleCoordChange = async (field, val) => {
    const coords = { ...gen.coordinates, [field]: val };
    setGen(p => ({ ...p, coordinates: coords }));
    if (coords.lat && coords.lng && !isNaN(coords.lat) && !isNaN(coords.lng)) {
      const addr = await reverseGeocode(coords.lat, coords.lng);
      if (addr) setGen(p => ({ ...p, address: addr }));
    }
  };

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      await authApi.updateProfile({
        firstName: gen.firstName, lastName: gen.lastName,
        age: gen.age ? Number(gen.age) : null,
        gender: gen.gender, phone: gen.phone,
        adminDistrict: gen.adminDistrict,
        coordinates: { lat: Number(gen.coordinates.lat) || null, lng: Number(gen.coordinates.lng) || null },
        address: gen.address,
        govNotifications, govGuidelines,
      }, accessToken);
      await refreshProfile();
      setMsg('Profile saved!');
    } catch (e) { setMsg(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-surface">
      <div className="sticky top-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center gap-3 min-h-[56px]">
        <button onClick={() => navigate(-1)} className="text-text-secondary hover:text-primary transition-colors min-h-[48px] flex items-center"><ArrowLeft size={20} /></button>
        <h1 className="font-body font-semibold text-lg text-text-primary">Admin Profile</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
          {user?.adminId || user?.ashaCertificateId || 'ADMIN'}
        </span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* General Info */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-primary"><User size={18} /><h2 className="font-semibold text-base text-text-primary">General Info</h2></div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-text-primary">First Name</span>
              <input className="input-field" value={gen.firstName} onChange={e => setGen(p => ({ ...p, firstName: e.target.value }))} /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-text-primary">Last Name</span>
              <input className="input-field" value={gen.lastName} onChange={e => setGen(p => ({ ...p, lastName: e.target.value }))} /></label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-text-primary">Age</span>
              <input className="input-field" type="number" min="0" max="120" value={gen.age} onChange={e => setGen(p => ({ ...p, age: e.target.value }))} /></label>
            <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-text-primary">Gender</span>
              <select className="input-field" value={gen.gender} onChange={e => setGen(p => ({ ...p, gender: e.target.value }))}>
                <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select></label>
            <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-text-primary">Phone</span>
              <input className="input-field" value={gen.phone} onChange={e => setGen(p => ({ ...p, phone: e.target.value }))} /></label>
          </div>

          <div className="text-sm font-medium text-text-primary">Email</div>
          <div className="text-sm text-text-secondary">{user?.email}</div>
          <div className="text-sm font-medium text-text-primary">Admin ID</div>
          <div className="text-sm text-text-secondary">{user?.adminId || user?.ashaCertificateId || '—'}</div>

          {/* Location */}
          <div className="flex items-center gap-2 mt-2"><MapPin size={16} className="text-primary" /><span className="text-sm font-medium text-text-primary">Location</span></div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input-field text-sm" placeholder="Latitude" value={gen.coordinates.lat} onChange={e => handleCoordChange('lat', e.target.value)} />
            <input className="input-field text-sm" placeholder="Longitude" value={gen.coordinates.lng} onChange={e => handleCoordChange('lng', e.target.value)} />
          </div>
          <button type="button" onClick={handleLocate} disabled={locating} className="btn-ghost text-xs flex items-center gap-1 px-0">
            {locating ? <><Loader size={14} className="animate-spin" /> Locating…</> : <><MapPin size={14} /> Use my current location</>}
          </button>
          {gen.address.city && <p className="text-xs text-text-secondary">{[gen.address.street, gen.address.city, gen.address.state, gen.address.pincode].filter(Boolean).join(', ')}</p>}
        </section>

        {/* Personal Info */}
        <section className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-primary"><Shield size={18} /><h2 className="font-semibold text-base text-text-primary">District & Admin Info</h2></div>
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium text-text-primary">District</span>
            <input className="input-field" value={gen.adminDistrict} onChange={e => setGen(p => ({ ...p, adminDistrict: e.target.value }))} /></label>
          <div className="text-sm font-medium text-text-primary">Admin ID</div>
          <div className="text-sm text-text-secondary">{user?.adminId || user?.ashaCertificateId || '—'}</div>
        </section>

        <ListSection icon={Bell} title="Gov Notifications" items={govNotifications}
          onAdd={v => setGovNotifications(p => [...p, v])} onRemove={v => setGovNotifications(p => p.filter(i => i !== v))}
          placeholder="e.g. New vaccination drive starting May 1" />

        <ListSection icon={BookOpen} title="Gov Guidelines" items={govGuidelines}
          onAdd={v => setGovGuidelines(p => [...p, v])} onRemove={v => setGovGuidelines(p => p.filter(i => i !== v))}
          placeholder="e.g. COVID-19 booster protocol v3" />

        {msg && <p className={`text-sm text-center ${msg.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>}
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          <Save size={18} />{saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
