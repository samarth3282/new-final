import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { authApi } from '../../auth/authApi';
import {
  ArrowLeft, Save, Plus, X, MapPin, User, AlertCircle,
  Heart, Pill, Users, Loader, Pencil, Check,
} from 'lucide-react';

/* ───────────── helpers ───────────── */
function calcAge(dob) {
  if (!dob) return '';
  const d = new Date(dob);
  return Math.floor((Date.now() - d.getTime()) / 31557600000);
}

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
  } catch {
    return null;
  }
}

/* ───────────── Simple relatives list ───────────── */
function RelativesList({ relatives, onAdd, onEdit, onRemove }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ patientId: '', relationship: '' });

  function openAdd() { setForm({ patientId: '', relationship: '' }); setEditId(null); setShowForm(true); }
  function openEdit(r) { setForm({ patientId: r.patientId, relationship: r.relationship }); setEditId(r._id); setShowForm(true); }
  function cancel() { setShowForm(false); setEditId(null); }

  function submit() {
    if (!form.patientId.trim() || !form.relationship.trim()) return;
    const entry = {
      patientId: form.patientId.trim(),
      relationship: form.relationship.trim(),
    };
    if (editId) {
      onEdit(editId, entry);
    } else {
      onAdd(entry);
    }
    setShowForm(false);
    setEditId(null);
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-primary">
          <Users size={18} />
          <h2 className="font-semibold text-base text-text-primary">Family & Relatives</h2>
        </div>
        <button type="button" onClick={openAdd} className="btn-ghost px-2 py-1 text-xs flex items-center gap-1">
          <Plus size={14} /> Add
        </button>
      </div>

      {showForm && (
        <div className="flex flex-col gap-2 mb-4 p-3 rounded-xl" style={{ background: 'var(--color-surface-3)' }}>
          <input
            className="input-field text-sm" placeholder="Patient ID"
            value={form.patientId} onChange={e => setForm(p => ({ ...p, patientId: e.target.value }))}
            autoFocus
          />
          <input
            className="input-field text-sm" placeholder="Relationship (e.g. Mother, Son)"
            value={form.relationship} onChange={e => setForm(p => ({ ...p, relationship: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          />
          <div className="flex gap-2">
            <button type="button" onClick={submit} className="btn-primary text-sm py-2 flex items-center gap-1">
              <Check size={14} /> {editId ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={cancel} className="btn-ghost text-sm py-2">Cancel</button>
          </div>
        </div>
      )}

      {relatives.length === 0 && !showForm && (
        <p className="text-text-hint text-sm text-center py-4">No relatives added yet</p>
      )}

      <div className="flex flex-col gap-2">
        {relatives.map(r => (
          <div key={r._id || r.patientId} className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: 'var(--color-surface-2)' }}>
            <div>
              <span className="font-medium text-sm text-text-primary font-mono">{r.patientId}</span>
              <span className="ml-2 text-xs text-text-secondary px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                {r.relationship}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => openEdit(r)}
                className="p-1.5 rounded-md hover:bg-surface-3 text-text-secondary hover:text-primary transition-colors">
                <Pencil size={14} />
              </button>
              <button type="button" onClick={() => onRemove(r._id || r.patientId)}
                className="p-1.5 rounded-md hover:bg-red-100 text-text-secondary hover:text-red-600 dark:hover:bg-red-900/30 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────── Tag list component ───────────── */
function TagSection({ icon: Icon, title, items, onAdd, onRemove, color, placeholder }) {
  const [input, setInput] = useState('');
  const colorMap = {
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  };
  const iconColor = { red: 'text-red-600 dark:text-red-400', blue: 'text-blue-600 dark:text-blue-400', green: 'text-green-600 dark:text-green-400' };

  const handleAdd = () => {
    const v = input.trim();
    if (v && !items.includes(v)) onAdd(v);
    setInput('');
  };

  return (
    <section className="card p-5">
      <div className={`flex items-center gap-2 mb-1 ${iconColor[color]}`}>
        <Icon size={18} /><h2 className="font-semibold text-base text-text-primary">{title}</h2>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {items.map(item => (
            <span key={item} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${colorMap[color]}`}>
              {item}
              <button type="button" onClick={() => onRemove(item)} className="hover:opacity-70"><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <input className="input-field flex-1 text-sm" placeholder={placeholder} value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }} />
        <button type="button" onClick={handleAdd} className="btn-ghost px-3"><Plus size={20} /></button>
      </div>
    </section>
  );
}

/* ═════════════ Main PatientProfile page ═════════════ */
export default function PatientProfile() {
  const navigate = useNavigate();
  const { user, accessToken, refreshProfile } = useAuth();

  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState('');

  const [gen, setGen] = useState({
    firstName: '', lastName: '', age: '', gender: '', phone: '',
    coordinates: { lat: '', lng: '' },
    address: { street: '', city: '', state: '', pincode: '' },
  });
  const [allergies, setAllergies] = useState([]);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [currentMedication, setCurrentMedication] = useState([]);
  const [relatives, setRelatives] = useState([]);

  useEffect(() => {
    if (!user) return;
    setGen({
      firstName: user.firstName || '', lastName: user.lastName || '',
      age: user.age ?? calcAge(user.dateOfBirth) ?? '',
      gender: user.gender || '', phone: user.phone || '',
      coordinates: { lat: user.coordinates?.lat ?? '', lng: user.coordinates?.lng ?? '' },
      address: { street: user.address?.street || '', city: user.address?.city || '', state: user.address?.state || '', pincode: user.address?.pincode || '' },
    });
    setAllergies(user.allergies || []);
    setMedicalHistory(user.medicalHistory || []);
    setCurrentMedication(user.currentMedication || []);
    setRelatives(user.relatives || []);
  }, [user]);

  const handleLocate = async () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const addr = await reverseGeocode(lat, lng);
        setGen(p => ({
          ...p,
          coordinates: { lat, lng },
          address: addr || p.address,
        }));
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
      // Strip temp _id values before sending to backend
      const cleanedRelatives = relatives.map(({ _id, patientId, relationship }) => ({
        patientId,
        relationship,
        ...(_id && !String(_id).startsWith('temp_') ? { _id } : {}),
      }));

      await authApi.updateProfile({
        firstName: gen.firstName, lastName: gen.lastName,
        age: gen.age ? Number(gen.age) : null,
        gender: gen.gender, phone: gen.phone,
        coordinates: { lat: Number(gen.coordinates.lat) || null, lng: Number(gen.coordinates.lng) || null },
        address: gen.address,
        allergies, medicalHistory, currentMedication,
        relatives: cleanedRelatives,
      }, accessToken);
      await refreshProfile();
      setMsg('Profile saved!');
    } catch (e) {
      setMsg(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const addRelative = (r) => setRelatives(p => [...p, { ...r, _id: `temp_${Date.now()}` }]);
  // removeRelative key is _id for saved, patientId for temp entries without _id

  const editRelative = (id, updates) => setRelatives(p => p.map(r => (r._id === id ? { ...r, ...updates } : r)));
  const removeRelative = (id) => setRelatives(p => p.filter(r => (r._id || r.patientId) !== id));

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center gap-3 min-h-[56px]">
        <button onClick={() => navigate(-1)} className="text-text-secondary hover:text-primary transition-colors min-h-[48px] flex items-center"><ArrowLeft size={20} /></button>
        <h1 className="font-body font-semibold text-lg text-text-primary">Patient Profile</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
          {user?.patientId}
        </span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* ── General Info ────────── */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-primary"><User size={18} /><h2 className="font-semibold text-base text-text-primary">General Info</h2></div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-primary">First Name</span>
              <input className="input-field" value={gen.firstName} onChange={e => setGen(p => ({ ...p, firstName: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-primary">Last Name</span>
              <input className="input-field" value={gen.lastName} onChange={e => setGen(p => ({ ...p, lastName: e.target.value }))} />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-primary">Age</span>
              <input className="input-field" type="number" min="0" max="120" value={gen.age} onChange={e => setGen(p => ({ ...p, age: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-primary">Gender</span>
              <select className="input-field" value={gen.gender} onChange={e => setGen(p => ({ ...p, gender: e.target.value }))}>
                <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-primary">Phone</span>
              <input className="input-field" value={gen.phone} onChange={e => setGen(p => ({ ...p, phone: e.target.value }))} />
            </label>
          </div>

          <div className="text-sm font-medium text-text-primary">Email</div>
          <div className="text-sm text-text-secondary">{user?.email}</div>
          <div className="text-sm font-medium text-text-primary">Patient ID</div>
          <div className="text-sm text-text-secondary">{user?.patientId}</div>

          {/* Location */}
          <div className="flex items-center gap-2 mt-2"><MapPin size={16} className="text-primary" /><span className="text-sm font-medium text-text-primary">Location</span></div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input-field text-sm" placeholder="Latitude" value={gen.coordinates.lat} onChange={e => handleCoordChange('lat', e.target.value)} />
            <input className="input-field text-sm" placeholder="Longitude" value={gen.coordinates.lng} onChange={e => handleCoordChange('lng', e.target.value)} />
          </div>
          <button type="button" onClick={handleLocate} disabled={locating} className="btn-ghost text-xs flex items-center gap-1 px-0">
            {locating ? <><Loader size={14} className="animate-spin" /> Locating…</> : <><MapPin size={14} /> Use my current location</>}
          </button>
          {gen.address.city && (
            <p className="text-xs text-text-secondary">{[gen.address.street, gen.address.city, gen.address.state, gen.address.pincode].filter(Boolean).join(', ')}</p>
          )}
        </section>

        {/* ── Personal Info ────────── */}
        <TagSection icon={AlertCircle} title="Allergies" items={allergies}
          onAdd={v => setAllergies(p => [...p, v])} onRemove={v => setAllergies(p => p.filter(i => i !== v))}
          color="red" placeholder="e.g. Peanuts, Penicillin" />

        <TagSection icon={Heart} title="Medical History" items={medicalHistory}
          onAdd={v => setMedicalHistory(p => [...p, v])} onRemove={v => setMedicalHistory(p => p.filter(i => i !== v))}
          color="blue" placeholder="e.g. Diabetes, Asthma" />

        <TagSection icon={Pill} title="Current Medication" items={currentMedication}
          onAdd={v => setCurrentMedication(p => [...p, v])} onRemove={v => setCurrentMedication(p => p.filter(i => i !== v))}
          color="green" placeholder="e.g. Metformin 500mg" />

        {/* ── Relatives list ────────── */}
        <RelativesList relatives={relatives} onAdd={addRelative} onEdit={editRelative} onRemove={removeRelative} />

        {/* ── Save ────────── */}
        {msg && <p className={`text-sm text-center ${msg.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>}
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          <Save size={18} />{saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
